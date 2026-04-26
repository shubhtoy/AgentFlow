---
name: dependency-management
description: Keep dependencies minimal, audit regularly, pin versions, check licenses, prefer well-maintained packages
domain: development
tags:
  - dependencies
  - packages
  - security
  - maintenance
---

# Dependency Management

Every dependency is a liability. It adds attack surface, maintenance burden, and upgrade risk. Be deliberate about what you bring in.

## Adding Dependencies

### Before Adding
- Do you actually need it? Can you write the 20 lines yourself?
- Is there a smaller alternative that does just what you need?
- Check the package: last publish date, open issues, download count, bus factor
- Read the license — is it compatible with your project?
- Check for known vulnerabilities (`npm audit`, `snyk`, GitHub advisories)
- Review the dependency tree — what does it pull in transitively?

### Decision Criteria
Add a dependency when:
- The functionality is complex and well-tested (crypto, parsing, compression)
- Maintaining it yourself would be a significant ongoing burden
- The package is actively maintained with a responsive maintainer

Write it yourself when:
- The functionality is simple (< 50 lines)
- The package has excessive transitive dependencies
- The package is unmaintained or has a single maintainer with no activity

## Version Pinning

- Pin exact versions in lock files (`package-lock.json`, `yarn.lock`)
- Use caret ranges (`^`) in `package.json` for libraries, exact versions for applications
- Commit lock files to version control — always
- Never delete and regenerate lock files without understanding the consequences

## Auditing

- Run `npm audit` (or equivalent) as part of CI — fail on critical/high vulnerabilities
- Review dependency updates weekly — don't let them pile up
- Use automated tools (Dependabot, Renovate) for update PRs
- Audit transitive dependencies, not just direct ones
- Remove unused dependencies — check with `depcheck` or similar tools

## License Compliance

- Know your project's license requirements
- Acceptable for most projects: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC
- Requires legal review: GPL, LGPL, AGPL, SSPL, Commons Clause
- Check transitive dependency licenses too — one GPL dep can affect your whole project
- Document license decisions for non-obvious cases

## Updating Dependencies

- Update one dependency at a time — easier to bisect if something breaks
- Read changelogs before updating — look for breaking changes
- Run the full test suite after every update
- For major version bumps, read the migration guide before starting
- Don't update dependencies during an active incident or release freeze

## Anti-Patterns
- Adding a package for a single utility function
- Ignoring `npm audit` warnings because "it's just a dev dependency"
- Using `*` or `latest` as version specifiers
- Copying code from a package instead of depending on it (loses updates)
- Depending on packages with no license specified
