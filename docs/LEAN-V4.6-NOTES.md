# LEAN V4.6 Implementation Notes

The router intentionally composes existing bridges rather than duplicating their safety logic. Web dispatch still uses `prepareMissionTaskDispatch`. Automation execution still uses `executeAutomationMissionTask`. This keeps V4.3-V4.5 guardrails authoritative while giving the mission layer one routing surface.
