---
type: instruction
name: requirements-elicitation
scope: workflow
domain: product-engineering
description: Systematic approach to gathering, structuring, and validating software requirements
tags:
  - requirements
  - user-stories
  - acceptance-criteria
narrativeTemplate:
  prefix: "Apply"
  suffix: "to structure the requirements"
---

# Requirements Elicitation

Transform vague feature requests into precise, testable requirements with clear acceptance criteria.

## Process

### 1. Understand the Request
- What problem does this solve? Who has this problem?
- What does success look like from the user's perspective?
- What are the boundaries — what is explicitly NOT in scope?

### 2. Identify Stakeholders
- Who are the direct users of this feature?
- Who are the indirect stakeholders (ops, security, support)?
- Are there upstream/downstream systems affected?

### 3. Write User Stories
Use the format: "As a [role], I want [capability], so that [benefit]."
- Each story should be independently deliverable
- Each story should be testable
- Avoid implementation details in the story itself

### 4. Define Acceptance Criteria
For each user story, write acceptance criteria using WHEN/THEN format:
- WHEN [condition], THEN [expected behavior]
- Cover the happy path, edge cases, and error cases
- Include performance criteria where relevant
- Include security criteria where relevant

### 5. Identify Non-Functional Requirements
- Performance: latency, throughput, resource usage
- Security: authentication, authorization, data protection
- Accessibility: WCAG compliance level
- Compatibility: browsers, devices, API versions

## Anti-Patterns to Avoid
- Requirements that describe HOW instead of WHAT
- Acceptance criteria that can't be objectively verified
- Missing error/edge case handling
- Assuming implementation details
