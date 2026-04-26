---
name: verify
description: Verify implementation against original requirements — tests, coverage, behavior
context:
  max_tokens: 8000
  inputs: [output.gather-requirements, output.implementation]
---

# Verify

Cross-reference the original requirements against the completed implementation. Consume {{<< output.gather-requirements}} and {{<< output.implementation}} and systematically verify each requirement is met.

## Verification Process

### 1. Requirements Traceability

Walk through every acceptance criterion in the requirements document. For each one:
- Identify which task addressed it
- Confirm tests exist that verify it
- Run the tests with {{capabilities/run-tests}} and confirm they pass
- Note any gaps

If a requirement has no corresponding test, that's a verification failure.

### 2. Test Suite Validation

Run the full test suite via {{capabilities/run-tests}} and confirm:
- All tests pass with zero failures
- No tests are skipped or pending
- No flaky tests that pass intermittently

Use {{instructions/test-analysis}} to assess coverage quality — are edge cases covered? Are error paths tested?

### 3. Code Quality Check

Run {{capabilities/get-diagnostics}} to check for:
- Type errors or compiler warnings
- Lint violations
- Unused imports or dead code

Use {{capabilities/grep-search}} to scan for common issues: TODO comments left behind, hardcoded values, debug logging.

### 4. Security Review

Apply {{instructions/security-review}} to the implementation:
- Input validation at all boundaries
- Auth checks where required
- No secrets in code
- Dependencies checked for vulnerabilities via {{capabilities/shell-exec}}

### 5. Accessibility Check

If the implementation includes UI work, apply {{instructions/accessibility}}:
- Semantic HTML structure
- Keyboard navigation
- Screen reader compatibility
- Color contrast compliance

### 6. Functional Testing

Use {{skills/webapp-testing}} to verify end-to-end behavior:
- Core user workflows function correctly
- Error states handled gracefully
- Edge cases behave as specified

### 7. Regression Check

Run the full existing test suite via {{capabilities/run-tests}}. Use {{capabilities/codebase-explorer}} to identify any integration points that might be affected. Verify no existing functionality was broken.

## Outcome

If all verifications pass, proceed to wrap-up. If any fail, document the specific failures with reproduction steps and route back to implementation.

{{-> wrap-up | all requirements verified and tests pass}}
{{-> implement | verification found issues — fix and re-verify}}
