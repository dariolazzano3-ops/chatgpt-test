"""Direct gateway regression tests for JARVIS rate-limit resilience v1.

Exercises the gateway's user-facing error reply
(``GatewayTurnMixin._hmwa_agent_error_reply``) for an explicit provider plan
usage-limit ("usage_limit_reached") wall:

  * the reset window is normalized from the SDK ``error.body`` OR, when that is
    absent / incomplete, from ``response.json()`` — numeric strings, epoch
    numbers and ISO-8601 timestamps are all accepted;
  * a valid absolute reset beats a conflicting relative one deterministically;
  * a 120-second window renders as "~2 minutes", never "~1 hour";
  * a multi-week window is still reported (no seven-day cutoff);
  * the usage-limit reply names the provider/model, tells the user to wait for
    the reset, and never suggests ``/reset`` / a fresh session (the quota is
    account-scoped — a new session hits the same wall);
  * an ordinary HTTP 429 with no usage-limit marker is unchanged — it still
    lands on the generic rate-limit hint, proving the guard stays narrow and no
    rotation/fallback/credential boundary is widened.

Frozen time; no network, no real session store. No assertions against
implementation source text.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

import gateway.run as gateway_run

# A fixed "now" comfortably past the epoch-vs-delay floor (1e7) so ``now + delta``
# values read as absolute epochs.
NOW = 1_700_000_000.0


@pytest.fixture(autouse=True)
def _frozen_now(monkeypatch):
    monkeypatch.setattr(time, "time", lambda: NOW)
    yield


def _iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat().replace("+00:00", "Z")


# ── Fakes ─────────────────────────────────────────────────────────────────────

class _FakeResponse:
    """Minimal stand-in for an httpx ``Response`` carried on an SDK error."""

    def __init__(self, *, json_body=None, headers=None):
        self._json_body = json_body
        self.headers = headers or {}

    def json(self):
        if self._json_body is None:
            raise ValueError("no JSON body")
        return self._json_body


class FakeAPIError(Exception):
    """OpenAI-SDK-shaped API error. ``body`` is only attached when supplied, so a
    ``response.json()``-only error genuinely has no ``.body`` attribute."""

    def __init__(self, message="", *, status_code=None, body=None, response=None):
        super().__init__(message)
        self.status_code = status_code
        if body is not None:
            self.body = body
        if response is not None:
            self.response = response


# ── Runner harness ───────────────────────────────────────────────────────────

def _make_runner(route=("anthropic", "claude-opus-5")):
    """A bare ``GatewayRunner`` with just the collaborators ``_hmwa_agent_error_reply``
    touches stubbed out."""
    runner = object.__new__(gateway_run.GatewayRunner)
    runner._hmwa_stop_typing_for_turn = AsyncMock()

    store = SimpleNamespace()
    runner.session_store = store
    runner._async_session_store = SimpleNamespace(
        _store=store,
        load_transcript=AsyncMock(return_value=[]),
        append_to_transcript=AsyncMock(),
    )
    runner._hmwa_user_transcript_entry = Mock(return_value={"role": "user", "content": "hi"})
    runner._hmwa_error_reply_route = Mock(return_value=route)
    return runner


async def _reply(runner, err):
    prepared = SimpleNamespace(message_text="hi", persist_user_message=None, history=[])
    return await runner._hmwa_agent_error_reply(
        err,
        SimpleNamespace(),                     # event
        SimpleNamespace(),                     # source
        SimpleNamespace(session_id="sess-1"),  # session_entry
        "agent:main:telegram:dm:chat",         # session_key
        prepared,
    )


def _usage_limit_error(**error_fields):
    body = {"error": {"type": "usage_limit_reached", "message": "You have reached your plan usage limit."}}
    body["error"].update(error_fields)
    return FakeAPIError("You have reached your plan usage limit.", status_code=429, body=body)


# ── Usage-limit reply: reset window + no /reset guidance ─────────────────────

class TestUsageLimitReply:
    @pytest.mark.asyncio
    async def test_names_route_reports_wait_and_omits_reset_guidance(self):
        runner = _make_runner()
        reply = await _reply(runner, _usage_limit_error(resets_in_seconds=120))

        assert "provider: anthropic" in reply
        assert "model: claude-opus-5" in reply
        assert "plan usage limit" in reply.lower()
        assert "~2 minutes" in reply
        assert "1 hour" not in reply
        # Account-scoped quota: never point the user at a fresh session.
        assert "/reset" not in reply
        assert "fresh session" not in reply.lower()
        assert "new session" not in reply.lower()
        # Persistence contract preserved: typing stopped, inbound user turn persisted once.
        runner._hmwa_stop_typing_for_turn.assert_awaited_once()
        runner._async_session_store.append_to_transcript.assert_awaited_once()
        runner._hmwa_error_reply_route.assert_called_once()

    @pytest.mark.asyncio
    async def test_reset_accepts_numeric_string(self):
        runner = _make_runner()
        reply = await _reply(runner, _usage_limit_error(resets_in_seconds="120"))
        assert "~2 minutes" in reply
        assert "/reset" not in reply

    @pytest.mark.asyncio
    async def test_absolute_iso8601_reset_is_normalized(self):
        runner = _make_runner()
        reply = await _reply(runner, _usage_limit_error(resets_at=_iso(NOW + 300)))
        assert "~5 minutes" in reply
        assert "/reset" not in reply

    @pytest.mark.asyncio
    async def test_absolute_epoch_number_reset_is_normalized(self):
        runner = _make_runner()
        reply = await _reply(runner, _usage_limit_error(resets_at=NOW + 240))
        assert "~4 minutes" in reply

    @pytest.mark.asyncio
    async def test_absolute_reset_wins_over_conflicting_relative(self):
        # resets_at says two minutes; a stale resets_in_seconds says an hour.
        runner = _make_runner()
        reply = await _reply(
            runner, _usage_limit_error(resets_at=NOW + 120, resets_in_seconds=3600)
        )
        assert "~2 minutes" in reply
        assert "1 hour" not in reply

    @pytest.mark.asyncio
    async def test_multi_week_reset_is_not_dropped_by_a_seven_day_cutoff(self):
        runner = _make_runner()
        ten_days = 10 * 24 * 3600
        reply = await _reply(runner, _usage_limit_error(resets_in_seconds=ten_days))
        assert "~240 hours" in reply
        assert "was not reported" not in reply

    @pytest.mark.asyncio
    async def test_unknown_reset_still_tells_user_to_wait_without_reset_command(self):
        runner = _make_runner()
        reply = await _reply(runner, _usage_limit_error())  # no reset field at all
        assert "was not reported" in reply
        assert "wait" in reply.lower()
        assert "/reset" not in reply

    @pytest.mark.asyncio
    async def test_malformed_reset_value_is_safe_and_still_omits_reset(self):
        runner = _make_runner()
        reply = await _reply(runner, _usage_limit_error(resets_at="not-a-date"))
        assert "was not reported" in reply
        assert "/reset" not in reply

    @pytest.mark.asyncio
    async def test_route_omitted_cleanly_when_unresolved(self):
        runner = _make_runner(route=(None, None))
        reply = await _reply(runner, _usage_limit_error(resets_in_seconds=120))
        assert "provider:" not in reply
        assert "model:" not in reply
        assert "~2 minutes" in reply
        assert "/reset" not in reply


# ── response.json() backfill when .body is absent / incomplete ──────────────

class TestUsageLimitReplyJsonBackfill:
    @pytest.mark.asyncio
    async def test_body_absent_reset_read_from_response_json(self):
        runner = _make_runner()
        resp = _FakeResponse(json_body={"error": {
            "type": "usage_limit_reached", "message": "weekly wall", "resets_in_seconds": "120",
        }})
        err = FakeAPIError("429", status_code=429, response=resp)
        reply = await _reply(runner, err)
        assert "plan usage limit" in reply.lower()
        assert "~2 minutes" in reply
        assert "/reset" not in reply

    @pytest.mark.asyncio
    async def test_incomplete_body_backfilled_from_json_without_losing_type(self):
        runner = _make_runner()
        body = {"error": {"type": "usage_limit_reached"}}  # no message, no reset
        resp = _FakeResponse(json_body={"error": {
            "type": "usage_limit_reached", "message": "weekly wall", "resets_at": _iso(NOW + 300),
        }})
        err = FakeAPIError("429", status_code=429, body=body, response=resp)
        reply = await _reply(runner, err)
        assert "~5 minutes" in reply
        assert "/reset" not in reply


# ── Boundary: ordinary 429 is unchanged (guard stays narrow) ────────────────

class TestOrdinaryRateLimitUnchanged:
    @pytest.mark.asyncio
    async def test_plain_429_still_gets_generic_rate_limit_hint_with_reset(self):
        runner = _make_runner()
        reply = await _reply(runner, FakeAPIError("Rate limit exceeded, slow down.", status_code=429))
        assert "rate-limited" in reply.lower()
        # The generic transient-error hint is deliberately left intact.
        assert "/reset" in reply
        assert "plan usage limit" not in reply.lower()
        runner._hmwa_error_reply_route.assert_not_called()

    @pytest.mark.asyncio
    async def test_plain_429_with_retry_after_is_not_a_usage_limit_wall(self):
        runner = _make_runner()
        resp = _FakeResponse(headers={"retry-after": "30"})
        err = FakeAPIError("Rate limit exceeded.", status_code=429, response=resp)
        reply = await _reply(runner, err)
        assert "plan usage limit" not in reply.lower()
        assert "rate-limited" in reply.lower()
