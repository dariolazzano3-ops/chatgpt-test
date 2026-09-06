# JARVIS Personal Assistant V1

JARVIS is the private personal assistant layer for the operator.

## Hard isolation rule

HAMYREN is a separate product and a separate data domain.

JARVIS:
- uses its own personal memory namespace: `jarvis.personal`
- does not read HAMYREN memory
- does not write HAMYREN memory
- does not share facts, goals, decisions, routines, preferences, or personal context with HAMYREN
- does not create an automatic data bridge to HAMYREN

## V1 foundation

The V1 foundation provides:
- personal context packaging
- intent classification
- action classification
- approval and autonomy gates
- explicit blocking of financial actions
- connector placeholders for calendar, email, tasks, files, research, automation, and smart home

Live connectors, voice, proactive monitoring, and persistent personal memory storage are intentionally not bound in this foundation commit.
