---
name: security-audit
description: Systematic security review covering OWASP Top 10, input validation, auth/authz, secrets management, dependency scanning, injection attacks, and XSS/CSRF prevention.
---

# Security Audit

## Mindset

Think like an attacker. For every input, ask: "What happens if I send something unexpected?" For every access control check, ask: "What happens if I skip this?" For every secret, ask: "Where else could this be visible?"

Security is not a feature you add at the end. It is a property of every line of code.

## Audit Process

### 1. Map the Attack Surface

Before reviewing code, understand what is exposed:

- **Entry points** — HTTP endpoints, WebSocket handlers, message queue consumers, CLI arguments, file uploads
- **Data flows** — Where does user input travel? Through which transformations? Into which stores?
- **Trust boundaries** — Where does trusted code interact with untrusted data? (browser → server, server → database, service → service)
- **Authentication boundaries** — Which endpoints require auth? Which are public?
- **Sensitive data** — Where is PII, credentials, financial data stored, processed, and transmitted?

### 2. Review by Category

Work through each category systematically. Do not skip categories because "we don't do that" — verify it.

## Injection

### SQL Injection

**The rule:** Never concatenate user input into SQL queries.

Vulnerable:
```sql
query = "SELECT * FROM users WHERE id = " + userId
```

Safe:
```sql
query = "SELECT * FROM users WHERE id = $1", [userId]
```

Check for:
- Raw SQL with string concatenation or template literals
- ORM methods that accept raw SQL fragments
- Stored procedures that build dynamic SQL
- Any place where user input reaches a query without parameterization

### Command Injection

**The rule:** Never pass user input to shell commands.

Vulnerable:
```python
os.system(f"convert {filename} output.png")
```

Safe:
```python
subprocess.run(["convert", filename, "output.png"], shell=False)
```

Check for:
- `exec`, `eval`, `system`, `popen`, `spawn` with user-controlled arguments
- Template engines rendering user input as code
- Deserialization of untrusted data (pickle, YAML load, Java serialization)

### NoSQL Injection

Vulnerable:
```javascript
db.users.find({ username: req.body.username })
// attacker sends: { "username": { "$gt": "" } }
```

Safe:
```javascript
db.users.find({ username: String(req.body.username) })
```

## Cross-Site Scripting (XSS)

### Stored XSS

User input is saved and rendered to other users without encoding.

Check for:
- User-generated content rendered as HTML (comments, profiles, messages)
- `innerHTML`, `dangerouslySetInnerHTML`, `v-html` with user data
- Server-side templates that render unescaped variables

### Reflected XSS

User input from the URL or form is reflected in the response without encoding.

Check for:
- Query parameters rendered in error messages or search results
- Redirect URLs constructed from user input
- JSON responses with `Content-Type: text/html`

### Prevention

- Encode output for the context (HTML, JavaScript, URL, CSS)
- Use Content Security Policy (CSP) headers
- Set `HttpOnly` and `Secure` flags on cookies
- Use frameworks that auto-escape by default (React, Angular, Jinja2 with autoescape)

## Cross-Site Request Forgery (CSRF)

Check for:
- State-changing operations (POST, PUT, DELETE) without CSRF tokens
- Cookie-based authentication without `SameSite` attribute
- CORS configuration that allows arbitrary origins

Prevention:
- Use `SameSite=Strict` or `SameSite=Lax` on session cookies
- Implement CSRF tokens for all state-changing requests
- Verify `Origin` and `Referer` headers on sensitive endpoints

## Authentication

Check for:
- Passwords stored in plaintext or with weak hashing (MD5, SHA1)
- Missing rate limiting on login endpoints
- Session tokens that are predictable or insufficiently random
- Missing session expiration or rotation after login
- Password reset tokens that don't expire
- Multi-factor authentication bypass paths
- Credentials in URL query parameters (logged by proxies and browsers)

Requirements:
- Use bcrypt, scrypt, or Argon2 for password hashing
- Generate session tokens with cryptographically secure random generators
- Implement account lockout after repeated failures
- Rotate session tokens after authentication state changes
- Use short-lived JWTs (15-60 min) with refresh token rotation

## Authorization

Check for:
- Missing authorization checks on endpoints (authenticated ≠ authorized)
- Insecure Direct Object References (IDOR) — can user A access user B's data by changing an ID?
- Privilege escalation — can a regular user access admin endpoints?
- Missing authorization on file uploads, exports, or bulk operations
- Client-side authorization checks without server-side enforcement

Requirements:
- Check authorization on every request, not just at the UI level
- Use the principle of least privilege — default deny
- Validate that the authenticated user owns or has access to the requested resource
- Log authorization failures for monitoring

## Secrets Management

Check for:
- Hardcoded secrets in source code (API keys, passwords, tokens)
- Secrets in configuration files committed to version control
- Secrets in environment variables visible in process listings
- Secrets logged in application logs or error messages
- Secrets in client-side code (JavaScript bundles, mobile apps)
- `.env` files not in `.gitignore`

Requirements:
- Use a secrets manager (Vault, AWS Secrets Manager, etc.)
- Rotate secrets on a schedule and after any suspected compromise
- Use different secrets per environment (dev, staging, production)
- Scan commits for accidentally committed secrets (git-secrets, truffleHog)

## Dependency Security

Check for:
- Known vulnerabilities in dependencies (`npm audit`, `pip audit`, `cargo audit`)
- Outdated dependencies with security patches available
- Dependencies from untrusted sources
- Typosquatting risks (verify package names carefully)
- Lock files committed and up to date

Requirements:
- Run dependency audits in CI/CD
- Enable automated dependency update tools (Dependabot, Renovate)
- Pin dependency versions in production
- Review dependency changelogs before major updates

## Data Protection

Check for:
- Sensitive data transmitted over HTTP (not HTTPS)
- PII stored without encryption at rest
- Excessive data in API responses (returning full user objects when only name is needed)
- Missing data retention policies
- Backup data without encryption
- Logs containing sensitive data

Requirements:
- Encrypt data in transit (TLS 1.2+) and at rest
- Minimize data collection and retention
- Implement field-level encryption for highly sensitive data
- Sanitize logs to remove PII and credentials
- Return only necessary fields in API responses

## Security Headers

Verify these headers are set on all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Audit Output Format

```markdown
## Security Audit Summary

**Scope:** [What was reviewed]
**Date:** [Date]
**Severity counts:** Critical: N, High: N, Medium: N, Low: N

## Critical Findings

### [FINDING-001] [Title]
- **Severity:** Critical
- **Category:** [OWASP category]
- **Location:** [File:Line]
- **Description:** [What the vulnerability is]
- **Impact:** [What an attacker could do]
- **Remediation:** [Specific fix with code example]

## Recommendations

[Prioritized list of improvements]
```

## Audit Checklist

- [ ] All user input is validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] Output is encoded for the rendering context
- [ ] Authentication uses strong hashing and secure tokens
- [ ] Authorization is checked on every endpoint
- [ ] No secrets in source code or logs
- [ ] Dependencies are audited for known vulnerabilities
- [ ] HTTPS is enforced everywhere
- [ ] Security headers are configured
- [ ] CSRF protection is in place for state-changing operations
- [ ] Rate limiting is configured on authentication endpoints
- [ ] Error messages do not leak internal details
