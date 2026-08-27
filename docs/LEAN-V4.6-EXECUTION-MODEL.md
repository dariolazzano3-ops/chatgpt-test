# LEAN V4.6 Execution Model

Web tasks are prepared as external supervised dispatches and remain RUNNING until their Factory job is reconciled. Automation tasks can complete inline through the supervised runner. The unified router can therefore progress independent Automation work while exposing pending Web tasks without pretending external work has completed.
