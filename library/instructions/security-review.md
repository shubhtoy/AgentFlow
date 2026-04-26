---
name: security-review
description: Systematic security audit checklist for code and infrastructure
domain: security
tags:
  - security
  - audit
  - compliance
---

# Security Review

Systematic security audit checklist for code and infrastructure changes.

## Input Validation
- All user input sanitized before use
- SQL queries use parameterized statements (never string concatenation)
- File paths validated against directory traversal (`../`)
- URL redirects validated against an allowlist
- Content-Type headers validated on file uploads
- Input length limits enforced to prevent abuse
- Reject unexpected fields — don't silently ignore them

## Authentication & Authorization
- Auth checks on every protected endpoint — no exceptions
- Tokens have expiration and rotation policies
- Principle of least privilege for all roles and service accounts
- Session management follows OWASP guidelines
- Failed auth attempts are rate-limited and logged
- API keys are scoped to minimum required permissions

## Secrets Management
- No hardcoded secrets, API keys, or passwords in code
- Secrets loaded from environment variables or a vault service
- `.gitignore` covers all secret files and local config
- Secrets are rotated on a regular schedule
- Revoke compromised secrets immediately — don't just rotate

## Dependencies
- No known CVEs in dependencies (run `npm audit` or equivalent)
- Dependencies pinned to specific versions
- Minimal dependency surface — remove unused packages
- Review new dependencies before adding (maintainer, license, size)

## Data Protection
- Sensitive data encrypted at rest and in transit (TLS 1.2+)
- PII handling follows data classification policy
- Logs do not contain secrets, tokens, or PII
- Database backups are encrypted and access-controlled
- Data retention policies are implemented and enforced

## Output
Produce a findings report with:
- Severity: Critical / High / Medium / Low
- Location: file path and line number
- Description: what the issue is and why it matters
- Remediation: specific steps to fix the issue
- Verification: how to confirm the fix works
