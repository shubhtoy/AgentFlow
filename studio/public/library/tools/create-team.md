---
type: builtin
builtin_mapping: team_create
parameters:
  name:
    type: string
    description: "Team name"
    required: true
  agents:
    type: array
    description: "List of agent configurations to spawn in parallel"
    required: true
---
# Create Team

Create a team of parallel agents that can work simultaneously on different aspects of a task. Each agent runs independently with inter-agent communication via send-message.
