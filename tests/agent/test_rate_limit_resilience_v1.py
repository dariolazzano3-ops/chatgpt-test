"""Direct behavioral tests for JARVIS rate-limit resilience v1 (repair round 1).

Covers the repaired defects in the reset-window normalization and the explicit
provider plan usage-limit ("usage_limit_reached") wall:

  * ``response.json()`` is consulted to backfill an absent / empty / incomplete
    SDK ``error.body`` — merging missing usable fields WITHOUT losing an explicit
    ``usage_limit_reached`` code/type already on the body.
  * ``reset_at`` / ``resets_at`` / ``resets_in_seconds`` normalization accepts
    ints and numeric strings, epoch numbers and ISO-8601 timestamps, rejects
    malformed values safely, and has NO artificial seven-day upper bound.
  * Deterministic priority: a valid absolute reset (``resets_at`` then its
    ``reset_at`` alias) beats a relative one; an invalid absolute falls through
    to the next candidate; the canonical remaining delay is derived FROM the
    chosen absolute (a stale/conflicting ``resets_in_seconds`` never produces a
    contradictory operator wait). A single ``now`` reference is used throughout.
  * A 120-second window displays as "~2 minutes", never "~1 hour".
  * The user-facing usage-limit message never suggests ``/reset`` (the quota is
    account-scoped — a fresh session hits the same wall).
  * The real terminal path (``agent.turn_api_error.handle_api_error``) ends the
    turn on an explicit usage-limit wall BEFORE any retry backoff, credential
    rotation or fallback activation, while preserving the failure/persistence
    contract and leaving ordinary 429 rate limits on their normal recovery path.

Frozen time; sleeps / rotation / fallback are mocked and asserted not called.
No assertions against implementation source text.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from agent.error_classifier import FailoverReason, classify_api_error
from agent.agent_runtime_helpers import (
    extract_api_error_context,
    format_reset_wait_phrase,
    format_usage_limit_terminal_response,
)

# A fixed "now" comfortably past the epoch-vs-delay floor (1e7) so that
# ``now + delta`` values read as absolute epochs.
NOW = 1_700_000_000.0


# ── Fakes ─────────────────────────────────────────────────────────────────────

class _FakeResponse:
    """Minimal stand-in for an httpx ``Response`` on an SDK error."""

    def __init__(self, *, json_body=None, headers=None):
        self._json_body = json_body
        self.headers = headers or {}

    def json(self):
        if self._json_body is None:
            raise ValueError("no JSON body")
        return self._json_body


class FakeAPIError(Exception):
    """OpenAI-SDK-shaped API error. ``body`` is only attached when supplied so a
    ``response.json()``-only error has no ``.body`` at all."""

    def __init__(self, message="", *, status_code=None, body=None, response=None, headers=None):
        super().__init__(message)
        self.status_code = status_code
        if body is not None:
            self.body = body
        if response is not None:
            self.response = response
        elif headers is not None:
            self.response = _FakeResponse(headers=headers)


@pytest.fixture(autouse=True)
def _frozen_now(monkeypatch):
    monkeypatch.setattr(time, "time", lambda: NOW)
    yield


def _iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat().replace("+00:00", "Z")


# ── format_reset_wait_phrase ─────────────────────────────────────────────────

class TestFormatResetWaitPhrase:
    def test_120_seconds_is_two_minutes_not_one_hour(self):
        assert format_reset_wait_phrase(120) == "~2 minutes"

    def test_accepts_numeric_string(self):
        assert format_reset_wait_phrase("120") == "~2 minutes"

    def test_zero_is_momentarily(self):
        assert format_reset_wait_phrase(0) == "momentarily"

    def test_one_hour(self):
        assert format_reset_wait_phrase(3600) == "~1 hour"

    def test_multi_week_window_still_formats(self):
        assert format_reset_wait_phrase(10 * 24 * 3600) is not None

    @pytest.mark.parametrize("bad", [-5, "banana", None, float("inf"), float("nan"), True])
    def test_malformed_values_are_none(self, bad):
        assert format_reset_wait_phrase(bad) is None


# ── extract_api_error_context: reset-window normalization ────────────────────

def _ctx(body=None, *, status_code=429, response=None, headers=None, message="hit a limit"):
    return extract_api_error_context(
        FakeAPIError(message, status_code=status_code, body=body, response=response, headers=headers)
    )


class TestResetWindowNormalization:
    def test_relative_int(self):
        ctx = _ctx({"error": {"type": "x", "message": "m", "resets_in_seconds": 90}})
        assert ctx["resets_in_seconds"] == 90.0
        assert ctx["reset_at_epoch"] == pytest.approx(NOW + 90.0)

    def test_relative_numeric_string(self):
        ctx = _ctx({"error": {"type": "x", "message": "m", "resets_in_seconds": "90"}})
        assert ctx["resets_in_seconds"] == 90.0

    def test_absolute_epoch_number(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": NOW + 240}})
        assert ctx["resets_in_seconds"] == pytest.approx(240.0)
        assert ctx["reset_at_epoch"] == pytest.approx(NOW + 240)

    def test_absolute_epoch_numeric_string(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": str(int(NOW + 240))}})
        assert ctx["resets_in_seconds"] == pytest.approx(240.0, abs=1.0)

    def test_absolute_iso8601_timestamp(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": _iso(NOW + 300)}})
        assert ctx["resets_in_seconds"] == pytest.approx(300.0, abs=1.0)

    def test_absolute_wins_over_conflicting_relative_120s_not_1h(self):
        # resets_at says two minutes; a stale resets_in_seconds says an hour.
        ctx = _ctx({"error": {
            "message": "m", "resets_at": NOW + 120, "resets_in_seconds": 3600,
        }})
        assert ctx["resets_in_seconds"] == pytest.approx(120.0)
        assert format_reset_wait_phrase(ctx["resets_in_seconds"]) == "~2 minutes"

    def test_canonical_remaining_follows_absolute_even_when_relative_is_shorter(self):
        ctx = _ctx({"error": {
            "message": "m", "resets_at": NOW + 3600, "resets_in_seconds": 120,
        }})
        assert ctx["resets_in_seconds"] == pytest.approx(3600.0)
        assert format_reset_wait_phrase(ctx["resets_in_seconds"]) == "~1 hour"

    def test_resets_at_priority_over_reset_at_alias(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": NOW + 100, "reset_at": NOW + 5000}})
        assert ctx["resets_in_seconds"] == pytest.approx(100.0)

    def test_invalid_absolute_resets_at_falls_through_to_reset_at_alias(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": "soon", "reset_at": NOW + 300}})
        assert ctx["resets_in_seconds"] == pytest.approx(300.0)

    def test_beyond_seven_days_is_not_dropped(self):
        ten_days = 10 * 24 * 3600
        ctx = _ctx({"error": {"message": "m", "resets_in_seconds": ten_days}})
        assert ctx["resets_in_seconds"] == float(ten_days)
        assert "reset_at_epoch" in ctx

    @pytest.mark.parametrize("bad", ["banana", float("inf"), float("nan"), True, -30])
    def test_malformed_relative_values_are_safe(self, bad):
        ctx = _ctx({"error": {"message": "m", "resets_in_seconds": bad}})
        # negatives clamp to 0; everything else is rejected outright.
        if bad == -30:
            assert ctx["resets_in_seconds"] == 0.0
        else:
            assert "resets_in_seconds" not in ctx
            assert "reset_at_epoch" not in ctx

    def test_malformed_absolute_timestamp_is_safe(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": "not-a-date"}})
        assert "resets_in_seconds" not in ctx
        assert "reset_at_epoch" not in ctx

    def test_elapsed_absolute_window_clamps_remaining_to_zero(self):
        ctx = _ctx({"error": {"message": "m", "resets_at": NOW - 500}})
        assert ctx["resets_in_seconds"] == 0.0

    def test_retry_after_header_on_ordinary_rate_limit(self):
        ctx = _ctx(None, headers={"retry-after": "30"})
        assert ctx["resets_in_seconds"] == 30.0
        assert "usage_limit_reached" not in ctx


# ── response.json() backfill / merge ────────────────────────────────────────

class TestResponseJsonBackfill:
    def test_json_only_body_is_used(self):
        resp = _FakeResponse(json_body={"error": {
            "type": "usage_limit_reached", "message": "plan wall", "resets_in_seconds": 120,
        }})
        ctx = extract_api_error_context(FakeAPIError("429", status_code=429, response=resp))
        assert ctx["usage_limit_reached"] is True
        assert ctx["resets_in_seconds"] == pytest.approx(120.0)

    def test_incomplete_body_backfilled_from_json_without_losing_explicit_type(self):
        body = {"error": {"type": "usage_limit_reached"}}  # no message, no reset
        resp = _FakeResponse(json_body={"error": {
            "type": "usage_limit_reached", "message": "weekly wall", "resets_at": NOW + 300,
        }})
        ctx = extract_api_error_context(
            FakeAPIError("429", status_code=429, body=body, response=resp)
        )
        assert ctx["usage_limit_reached"] is True
        assert ctx["message"] == "weekly wall"
        assert ctx["resets_in_seconds"] == pytest.approx(300.0)

    def test_explicit_usage_limit_code_survives_a_different_json_code(self):
        body = {"error": {"code": "usage_limit_reached"}}
        resp = _FakeResponse(json_body={"error": {
            "code": "rate_limit_exceeded", "message": "slow down", "resets_in_seconds": 30,
        }})
        ctx = extract_api_error_context(
            FakeAPIError("429", status_code=429, body=body, response=resp)
        )
        assert ctx["reason"] == "usage_limit_reached"
        assert ctx["usage_limit_reached"] is True
        assert ctx["resets_in_seconds"] == pytest.approx(30.0)

    def test_classifier_also_backfills_incomplete_body_from_json(self):
        body = {"error": {"type": "usage_limit_reached"}}
        resp = _FakeResponse(json_body={"error": {
            "type": "usage_limit_reached", "message": "weekly wall", "resets_at": NOW + 300,
        }})
        result = classify_api_error(
            FakeAPIError("429", status_code=429, body=body, response=resp),
            provider="anthropic", model="claude-opus-5",
        )
        assert result.reason == FailoverReason.billing
        assert result.retryable is False
        assert result.error_context.get("usage_limit_reached") is True


# ── usage-limit message never suggests /reset ───────────────────────────────

class TestUsageLimitTerminalMessage:
    def test_no_reset_guidance_and_reports_wait(self):
        msg = format_usage_limit_terminal_response(
            {"resets_in_seconds": 120.0}, provider="anthropic", model="claude-opus-5",
        )
        assert "/reset" not in msg
        assert "fresh session" not in msg.lower()
        assert "new session" not in msg.lower()
        assert "2 minutes" in msg
        assert "provider" in msg.lower()

    def test_no_reset_guidance_when_reset_unknown(self):
        msg = format_usage_limit_terminal_response({}, provider="anthropic")
        assert "/reset" not in msg
        assert "wait" in msg.lower()

    def test_names_provider_and_model(self):
        msg = format_usage_limit_terminal_response(
            {"resets_in_seconds": 0.0}, provider="anthropic", model="claude-opus-5",
        )
        assert "anthropic" in msg and "claude-opus-5" in msg
        assert "/reset" not in msg


# ── classifier: explicit wall vs ordinary rate limits ──────────────────────

class TestClassifierBoundary:
    def test_structured_usage_limit_reached_is_terminal_billing(self):
        e = FakeAPIError("usage limit reached", status_code=429, body={
            "error": {"type": "usage_limit_reached", "message": "wall", "resets_in_seconds": 120},
        })
        result = classify_api_error(e, provider="anthropic", model="claude-opus-5")
        assert result.reason == FailoverReason.billing
        assert result.retryable is False
        assert result.error_context.get("usage_limit_reached") is True

    def test_plain_429_rate_limit_is_retryable_and_not_a_wall(self):
        result = classify_api_error(
            FakeAPIError("Rate limit exceeded, slow down.", status_code=429),
            provider="anthropic", model="claude-opus-5",
        )
        assert result.reason == FailoverReason.rate_limit
        assert result.retryable is True
        assert not result.error_context.get("usage_limit_reached")

    def test_429_overloaded_body_still_backs_off_as_overloaded(self):
        result = classify_api_error(
            FakeAPIError("The service is temporarily overloaded", status_code=429),
            provider="anthropic", model="claude-opus-5",
        )
        assert result.reason == FailoverReason.overloaded
        assert result.retryable is True


# ── real terminal path: agent.turn_api_error.handle_api_error ───────────────

def _make_agent():
    return SimpleNamespace(
        thinking_callback=None,
        provider="anthropic",
        model="claude-opus-5",
        log_prefix="",
        _extract_api_error_context=extract_api_error_context,
        _invoke_api_request_error_hook=Mock(),
        _flush_status_buffer=Mock(),
        _summarize_api_error=Mock(return_value="plan usage limit reached"),
        _emit_status=Mock(),
        _persist_session=Mock(),
        _swap_credential=Mock(),
        _try_activate_fallback=Mock(return_value=False),
    )


def _handle_kwargs(err):
    return dict(
        api_error=err,
        _retry=SimpleNamespace(),
        thinking_spinner=None,
        messages=[{"role": "user", "content": "hi"}],
        api_messages=[{"role": "user", "content": "hi"}],
        api_kwargs={},
        system_message=None,
        active_system_prompt="sys",
        conversation_history=[],
        approx_tokens=0,
        retry_count=0,
        max_retries=5,
        compression_attempts=0,
        max_compression_attempts=3,
        api_call_count=1,
        api_request_id="req",
        api_start_time=NOW,
        effective_task_id="task",
        turn_id="turn",
    )


@pytest.fixture
def _patched_turn_api_error(monkeypatch):
    import agent.turn_api_error as tae
    import tools.interpreter_shutdown as shutdown

    recover_before = Mock(side_effect=lambda *a, **k: (False, k["active_system_prompt"]))
    recover_after = Mock(side_effect=AssertionError("recover_after_classification must not run"))
    route = Mock(side_effect=AssertionError("route_classified_error must not run"))
    sleep = Mock(side_effect=AssertionError("no sleep on the terminal usage-limit path"))

    monkeypatch.setattr(shutdown, "interpreter_shutting_down", lambda _e: False)
    monkeypatch.setattr(tae, "recover_before_classification", recover_before)
    monkeypatch.setattr(tae, "recover_after_classification", recover_after)
    monkeypatch.setattr(tae, "route_classified_error", route)
    monkeypatch.setattr(time, "sleep", sleep)
    return SimpleNamespace(
        tae=tae, recover_before=recover_before, recover_after=recover_after,
        route=route, sleep=sleep, monkeypatch=monkeypatch,
    )


class TestTerminalUsageLimitPath:
    def test_ends_turn_before_retry_rotation_or_fallback(self, _patched_turn_api_error):
        p = _patched_turn_api_error
        agent = _make_agent()
        err = FakeAPIError(
            "You have reached your plan usage limit.",
            status_code=429,
            body={"error": {
                "type": "usage_limit_reached",
                "message": "You have reached your plan usage limit.",
                "resets_in_seconds": 120,
            }},
        )

        verdict = p.tae.handle_api_error(agent, **_handle_kwargs(err))

        assert verdict.action == "return"
        res = verdict.result
        assert res["failed"] is True
        assert res["failure_retryable"] is False
        assert res["completed"] is False
        assert "/reset" not in res["final_response"]
        assert "2 minutes" in res["final_response"]
        # No recovery / backoff / rotation / fallback happened.
        p.recover_after.assert_not_called()
        p.route.assert_not_called()
        p.sleep.assert_not_called()
        agent._swap_credential.assert_not_called()
        agent._try_activate_fallback.assert_not_called()
        # Failure/persistence contract preserved.
        agent._persist_session.assert_called_once()

    def test_ordinary_429_still_reaches_normal_recovery(self, _patched_turn_api_error):
        p = _patched_turn_api_error
        # Ordinary rate limit: recovery IS consulted (guard does not fire).
        recovered = Mock(return_value=(True, False))
        p.monkeypatch.setattr(p.tae, "recover_after_classification", recovered)
        agent = _make_agent()
        err = FakeAPIError("Rate limit exceeded, slow down.", status_code=429)

        verdict = p.tae.handle_api_error(agent, **_handle_kwargs(err))

        assert verdict.action == "continue"
        recovered.assert_called_once()
        agent._persist_session.assert_not_called()
        agent._swap_credential.assert_not_called()
