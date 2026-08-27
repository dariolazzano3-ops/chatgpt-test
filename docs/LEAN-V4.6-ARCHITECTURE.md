# LEAN V4.6 Architecture

`mission-execution-router.js` sits above the Web and Automation mission bridges. It selects the bridge from the task execution contract, preserves each bridge's existing authorization and result semantics, and performs bounded dependency-aware progression over READY tasks.
