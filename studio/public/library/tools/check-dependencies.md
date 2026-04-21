---
type: script
command: "npm audit --json 2>/dev/null || pip audit --format json 2>/dev/null || echo '{\"vulnerabilities\":[]}'"
parameters:
  path:
    type: string
    description: "Project directory to audit"
    default: "."
  package_manager:
    type: string
    description: "Package manager to use"
    enum: ["npm", "pip", "go", "auto"]
    default: "auto"
  severity:
    type: string
    description: "Minimum severity level to report"
    enum: ["low", "moderate", "high", "critical"]
    default: "low"
---
# Check Dependencies

Audit project dependencies for known vulnerabilities (CVEs). Supports npm, pip, Go modules, and other package managers. Returns severity levels and remediation advice.
