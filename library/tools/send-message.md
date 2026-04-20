---
type: builtin
builtin_mapping: send_message
parameters:
  to:
    type: string
    description: "Agent ID or name to send the message to"
    required: true
  message:
    type: string
    description: "Message content"
    required: true
---
# Send Message

Send a message to another agent. Use to continue a previously spawned agent or communicate between agents in a team. The target agent resumes with its full context preserved.
