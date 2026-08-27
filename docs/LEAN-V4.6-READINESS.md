# LEAN V4.6 Readiness

V4.6 is ready to merge when all of the following remain true:

- the unified mission execution router supports Web and Automation engines
- Web tasks remain supervised external dispatches
- Automation tasks use the supervised Automation runner
- READY task execution is bounded
- dependency ordering prevents downstream execution before prerequisites complete
- explicit adapter dispatch authorization is still required
- production deployment remains disabled
- automatic adapter dispatch remains disabled
- automatic multi-factory execution remains disabled
- V4.6 smoke and readiness checks pass in CI

This release is an execution-routing layer, not a production autonomy switch.
