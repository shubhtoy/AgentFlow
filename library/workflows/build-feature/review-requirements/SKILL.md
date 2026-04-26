---
name: review-requirements
type: step
description: Present requirements for user approval with structured communication
context:
  inputs: [output.gather-requirements]
---

# Review Requirements

Present the requirements document from {{<< output.gather-requirements}} to the user for review. Use {{skills/writing-plans}} to structure the presentation clearly — lead with the most important information, group related items, highlight open questions.

## Presentation

### 1. Executive Summary

Start with a one-paragraph summary of what will be built and why. Reference {{skills/internal-comms}} for clear, audience-appropriate communication — the user may not be technical.

### 2. Requirements Walkthrough

Present requirements grouped by category:
- **Core functionality** — what the system must do
- **Constraints** — performance, security, compatibility
- **Out of scope** — what was explicitly excluded and why

For each requirement, state it clearly and note the source (which part of the interview produced it).

### 3. Open Questions

Highlight any areas where:
- The user gave ambiguous or conflicting answers
- You made assumptions that need confirmation
- Edge cases were identified but not resolved

### 4. Completeness Check

Walk through {{instructions/requirements-elicitation}} criteria to confirm nothing was missed:
- User stories with acceptance criteria
- Non-functional requirements
- Error scenarios
- Data migration needs (if applicable)

### 5. Seek Approval

Ask the user to:
- Confirm each requirement is accurately captured
- Flag anything missing or incorrect
- Approve to proceed or request another interview round

Be explicit: "Do you approve these requirements, or would you like to revise?"

{{-> create-design | user approved the requirements}}
{{-> gather-requirements | user wants changes — incorporate feedback}}
