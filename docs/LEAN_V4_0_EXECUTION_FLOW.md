Mission Web Executor is the supervised bridge between durable mission tasks and the existing Factory Control workflow. It never deploys production and never implements a second web build engine.

The supervisor observes the canonical durable Factory job until a terminal state and then reconciles the validated result back into the same mission task.
