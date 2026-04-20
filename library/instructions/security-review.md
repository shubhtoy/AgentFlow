---
type: instruction
name: security-review
scope: workflow
domain: security
description: Systematic security audit checklist for code and infrastructure
tags:
  - security
  - audit
  - compliance
narrativeTemplate:
  prefix: "Apply"
  suffix: "to identify security concerns"
---

# Security Review

Systematic security audit checklist for code and infrastructure.

## Input Validation
- All user input sanitized before use
- SQL queries use parameterized statements (never string concat)
- File paths validated against directory traversal
- URL redirects validated against allowlist

## Authentication & Authorization
- Auth checks on every protected endpoint
- Tokens have expiration and rotation
- Principle of least privilege for all roles
- Session management follows OWASP guidelines

## Secrets Management
- No hardcoded secrets, API keys, or passwords in code
- Secrets loaded from environment or vault
- .gitignore covers all secret files

## Dependencies
- No known CVEs in dependencies
- Dependencies pinned to specific versions
- Minimal dependency surface — remove unused packages

## Data Protection
- Sensitive data encrypted at rest and in transit
- PII handling follows data classification policy
- Logs do not contain secrets or PII

## Output
Produce a findings report with severity (Critical/High/Medium/Low) and remediation steps for each issue.
