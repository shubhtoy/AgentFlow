---
name: requirements-format
description: Standard template and format for requirements documents
narrativeTemplate:
  prefix: "Document requirements using this format:"
  suffix: "Every section must be filled. Leave nothing implicit."
---

# Requirements Format

All requirements documents produced in this workflow MUST follow this structure:

## Template

### 1. User Story
> As a [role], I want [capability] so that [benefit].

### 2. Acceptance Criteria
Numbered list of testable conditions that must be true for the feature to be considered complete. Each criterion should be independently verifiable.

### 3. Constraints
- Technical constraints (language, framework, platform)
- Performance constraints (latency, throughput, memory)
- Security constraints (authentication, authorization, data handling)
- Compatibility constraints (browsers, APIs, backward compatibility)

### 4. Out of Scope
Explicitly list what this feature does NOT include. This prevents scope creep and sets clear boundaries.

### 5. Dependencies
External systems, APIs, libraries, or other features this work depends on.

### 6. Open Questions
Unresolved items that need answers before or during implementation.
