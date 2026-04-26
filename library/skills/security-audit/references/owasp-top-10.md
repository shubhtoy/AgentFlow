# OWASP Top 10 (2021) Quick Reference

## A01:2021 — Broken Access Control

Missing or ineffective access control enforcement. Users can act outside their intended permissions.

**Examples:** IDOR, privilege escalation, CORS misconfiguration, missing function-level access control.

**Prevention:** Default deny, server-side enforcement, disable directory listing, log access failures, rate limit APIs.

## A02:2021 — Cryptographic Failures

Sensitive data exposed due to weak or missing cryptography.

**Examples:** Plaintext transmission, weak hashing (MD5/SHA1 for passwords), missing encryption at rest, hardcoded keys.

**Prevention:** Classify data sensitivity, encrypt in transit (TLS 1.2+) and at rest, use strong algorithms (AES-256, bcrypt/Argon2), don't cache sensitive responses.

## A03:2021 — Injection

Untrusted data sent to an interpreter as part of a command or query.

**Examples:** SQL injection, NoSQL injection, OS command injection, LDAP injection, XSS.

**Prevention:** Parameterized queries, input validation (allowlist), escape output for context, use ORMs carefully.

## A04:2021 — Insecure Design

Missing or ineffective security controls at the design level. Cannot be fixed by implementation alone.

**Examples:** Missing rate limiting on sensitive operations, no fraud protection, trust boundary violations.

**Prevention:** Threat modeling, secure design patterns, reference architectures, abuse case testing.

## A05:2021 — Security Misconfiguration

Insecure default configurations, incomplete configurations, open cloud storage, verbose error messages.

**Examples:** Default credentials, unnecessary features enabled, missing security headers, overly permissive CORS.

**Prevention:** Hardened defaults, minimal platform, review configurations, automated verification.

## A06:2021 — Vulnerable and Outdated Components

Using components with known vulnerabilities or without active maintenance.

**Examples:** Unpatched libraries, unsupported frameworks, outdated OS components.

**Prevention:** Inventory dependencies, monitor CVEs, automate updates, remove unused dependencies.

## A07:2021 — Identification and Authentication Failures

Weaknesses in authentication and session management.

**Examples:** Credential stuffing, weak passwords allowed, missing MFA, session fixation, token exposure in URLs.

**Prevention:** MFA, strong password policies, rate limiting, secure session management, credential rotation.

## A08:2021 — Software and Data Integrity Failures

Code and infrastructure that does not protect against integrity violations.

**Examples:** Insecure CI/CD pipelines, auto-update without verification, unsigned artifacts, deserialization of untrusted data.

**Prevention:** Digital signatures, trusted repositories, CI/CD access controls, integrity verification.

## A09:2021 — Security Logging and Monitoring Failures

Insufficient logging, monitoring, and incident response capability.

**Examples:** Missing audit logs, logs not monitored, no alerting on suspicious activity, logs stored only locally.

**Prevention:** Log authentication and access control events, centralize logs, implement alerting, test incident response.

## A10:2021 — Server-Side Request Forgery (SSRF)

Application fetches a remote resource without validating the user-supplied URL.

**Examples:** Fetching URLs from user input, accessing internal services via URL manipulation, cloud metadata endpoint access.

**Prevention:** Allowlist URLs, block private IP ranges, don't send raw responses to clients, disable HTTP redirects for server-side requests.

---

Source: https://owasp.org/Top10/
