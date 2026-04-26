# Conventional Commits Quick Reference

Specification: https://www.conventionalcommits.org/en/v1.0.0/

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

- `feat` — A new feature (correlates with MINOR in SemVer)
- `fix` — A bug fix (correlates with PATCH in SemVer)
- `docs` — Documentation only changes
- `style` — Changes that do not affect the meaning of the code (whitespace, formatting)
- `refactor` — A code change that neither fixes a bug nor adds a feature
- `perf` — A code change that improves performance
- `test` — Adding missing tests or correcting existing tests
- `chore` — Changes to the build process or auxiliary tools and libraries
- `ci` — Changes to CI configuration files and scripts
- `revert` — Reverts a previous commit

## Breaking Changes

Indicated by `!` after the type/scope, or by a `BREAKING CHANGE:` footer:

```
feat(api)!: Remove deprecated endpoint

BREAKING CHANGE: /v1/legacy has been removed. Use /v2/current instead.
```

Breaking changes correlate with MAJOR in SemVer.

## Scope

Optional. Describes the section of the codebase:

```
feat(auth): Add OAuth2 provider
fix(parser): Handle empty input gracefully
docs(readme): Update installation instructions
```

## Rules

1. Type is required and must be lowercase
2. Description is required, imperative mood, no period at end
3. Body is optional, separated by blank line, wrapped at 72 chars
4. Footer is optional, follows git trailer format (`key: value`)
5. Breaking changes must be indicated in type prefix or footer

## Examples

```
feat: Add email notification on signup

Send a welcome email when a new user completes registration.
Uses the existing email service with a new template.

Closes #234
```

```
fix(db): Prevent connection pool exhaustion under load

Connections were not being returned to the pool when queries
timed out. Added explicit cleanup in the error handler.
```

```
chore(deps): Bump lodash from 4.17.20 to 4.17.21

Addresses prototype pollution vulnerability CVE-2021-23337.
```
