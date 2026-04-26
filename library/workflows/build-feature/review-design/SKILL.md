---
name: review-design
type: step
description: Present technical design for user approval with clear trade-off analysis
context:
  inputs: [output.create-design]
---

# Review Design

Present the technical design from {{<< output.create-design}} to the user for review and approval.

## Presentation Structure

Follow {{skills/writing-plans}} for clear, structured presentation of complex technical content. Use {{skills/internal-comms}} for audience-appropriate communication.

## Process

### 1. Architecture Summary

Present the high-level architecture in plain language:
- What components exist and what each one does
- How they communicate with each other
- Where data lives and how it flows

### 2. Key Decisions and Trade-offs

For each significant architectural decision, present:
- What was decided and why
- What alternatives were considered
- What trade-offs were accepted
- What risks remain

Be transparent about compromises. The user needs to understand what they're approving.

### 3. Risks and Mitigations

Highlight anything that could go wrong:
- Technical risks (performance, scalability, complexity)
- Dependency risks (external services, libraries)
- Timeline risks (unknowns, learning curves)

### 4. Seek Approval

Ask the user specifically:
- Does the architecture make sense for your use case?
- Are there constraints the design missed?
- Are the trade-offs acceptable?

Do not proceed until the user explicitly approves or provides feedback.

{{-> plan-tasks | instructions/approval-criteria}}
{{-> design-agentflow-feature | user approved the design and the feature is an AgentFlow workflow}}
{{-> create-design | user wants design changes — incorporate architectural feedback}}
