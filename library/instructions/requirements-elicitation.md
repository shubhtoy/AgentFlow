---
name: requirements-elicitation
description: Systematic approach to gathering, structuring, and validating software requirements
domain: product-engineering
tags:
  - requirements
  - user-stories
  - acceptance-criteria
---

# Requirements Elicitation

Transform vague feature requests into precise, testable requirements with clear acceptance criteria.

## Process

### 1. Understand the Request
- What problem does this solve? Who has this problem?
- What does success look like from the user's perspective?
- What are the boundaries — what is explicitly NOT in scope?
- What is the priority and timeline?
- Are there existing solutions or workarounds?

### 2. Identify Stakeholders
- Who are the direct users of this feature?
- Who are the indirect stakeholders (ops, security, support)?
- Are there upstream/downstream systems affected?
- Who has final approval authority?

### 3. Write User Stories
Use the format: "As a [role], I want [capability], so that [benefit]."
- Each story should be independently deliverable
- Each story should be testable
- Avoid implementation details in the story itself
- Order stories by priority and dependency
- Keep stories small enough to complete in one iteration

### 4. Define Acceptance Criteria
For each user story, write acceptance criteria using WHEN/THEN format:
- WHEN [condition], THEN [expected behavior]
- Cover the happy path, edge cases, and error cases
- Include performance criteria where relevant (response time, throughput)
- Include security criteria where relevant (auth, data protection)
- Each criterion must be objectively verifiable — no subjective language

### 5. Identify Non-Functional Requirements
- **Performance:** latency, throughput, resource usage, scalability limits
- **Security:** authentication, authorization, data protection, audit logging
- **Accessibility:** WCAG compliance level, keyboard navigation, screen readers
- **Compatibility:** browsers, devices, API versions, backward compatibility
- **Reliability:** uptime targets, failure modes, recovery procedures
- **Observability:** logging, metrics, alerting, debugging support

### 6. Validate Requirements
- Walk through each story with stakeholders
- Check for contradictions between stories
- Verify that acceptance criteria are testable
- Confirm nothing critical is missing
- Get explicit sign-off before proceeding to design

## Anti-Patterns to Avoid
- Requirements that describe HOW instead of WHAT
- Acceptance criteria that can't be objectively verified
- Missing error/edge case handling
- Assuming implementation details
- Scope creep — adding requirements without re-prioritizing
