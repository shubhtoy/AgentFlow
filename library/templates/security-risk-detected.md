---
name: security-risk-detected
type: condition
check: "The output or operation contains one or more security concerns: exposed secrets or credentials, known vulnerability patterns (e.g., SQL injection, XSS), unauthorized access attempts, policy violations, or dependencies with known CVEs"
narrativeTemplate:
  prefix: "If a security risk is detected,"
  suffix: "halt and escalate to the security team."
---
# Security Risk Detected

A potential security vulnerability, exposed secret, or policy violation has been identified. Halt the current operation and escalate for security review.
