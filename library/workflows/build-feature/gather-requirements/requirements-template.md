---
name: requirements-template
description: Template structure for the requirements document output
primary: false
---

# Requirements Document Template

Use this exact structure when writing the requirements document.

## Structure

```markdown
# Requirements Document

## Introduction

[1-2 paragraphs: What is this feature? What problem does it solve? Who benefits?]

## Glossary

- **[Term]**: [Definition]
- **[Term]**: [Definition]

## Requirements

### Requirement 1: [Short descriptive title]

**User Story:** As a [role], I want [capability], so that [benefit].

#### Acceptance Criteria

1. WHEN [precondition/trigger], THEN [expected system behavior].
2. WHEN [error condition], THEN [expected error handling].
3. WHEN [edge case], THEN [expected behavior].

### Requirement 2: [Title]
...

## Non-Functional Requirements

### Performance
- [Latency, throughput, resource constraints]

### Security
- [Auth, input validation, data protection]

### Compatibility
- [Browsers, devices, API versions]
```

## Rules

- Every acceptance criterion must be objectively testable
- Use WHEN/THEN, not IF/THEN (WHEN implies the condition will happen)
- Number everything — requirements, acceptance criteria
- Each requirement should be independently deliverable
- Don't describe HOW — only describe WHAT and WHEN/THEN
