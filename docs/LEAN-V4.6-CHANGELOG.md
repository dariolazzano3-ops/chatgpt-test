# LEAN V4.6 Changelog

- Added `src/mission-execution-router.js` as the unified supervised entry point for mission task execution.
- Added bounded execution of currently READY mission tasks with dependency-aware progression.
- Connected existing Web mission dispatch and Automation mission execution behind the same routing contract.
- Added smoke and readiness validation.
- Advanced runtime metadata to LEAN 4.6.
- Preserved manual dispatch authorization, disabled production deployment, and disabled automatic multi-factory execution.
