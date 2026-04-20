---
name: testing-strategy
domain: development
---
# Testing Strategy

Design a testing approach that catches bugs without slowing development.

## Process Steps
1. Assess the system: identify critical paths, external dependencies, and risk areas
2. Define the test pyramid ratio: unit (70%), integration (20%), E2E (10%)
3. Decide what to test: happy paths, edge cases, error cases, security cases
4. Decide what NOT to test: implementation details, trivial code, third-party internals
5. Set up mocking strategy: mock externals, never mock the thing under test
6. Establish quality criteria: naming, independence, determinism, speed

## Test Pyramid
- Unit tests (70%): fast, isolated, test one function/class
- Integration tests (20%): test component interactions, real DB/API
- E2E tests (10%): test full user flows, slowest but highest confidence

## What to Test
- Happy path: the normal, expected flow
- Edge cases: empty input, max values, boundary conditions
- Error cases: invalid input, network failures, timeouts
- Security cases: injection, unauthorized access, data leaks

## What NOT to Test
- Implementation details (private methods, internal state)
- Third-party library internals
- Trivial getters/setters with no logic
- UI layout pixel-by-pixel (use visual regression tools instead)

## Test Quality Checklist
- Each test has a clear, descriptive name
- Tests are independent (no shared mutable state)
- Tests are deterministic (no flaky failures)
- Tests run fast (<10 seconds for unit suite)
- Tests document behavior (readable as specifications)

## Mocking Guidelines
- Mock external dependencies (APIs, databases, file system)
- Don't mock the thing you're testing
- Prefer fakes over mocks when possible
- Keep mock data realistic and minimal

## Anti-Patterns
- Testing implementation details instead of behavior
- Writing tests after the code is "done" instead of alongside
- Over-mocking: mocking so much that the test proves nothing
- No test naming convention — `test1`, `test2` tell you nothing
- Slow test suites that developers skip running locally

## Output Format
A testing strategy document with: test pyramid breakdown, list of what to test per layer, mocking approach, quality criteria, and CI integration plan.

## Examples

### Example: Testing strategy for a REST API
**Unit (70%)**: Validation functions, business logic, data transformations. Mock: DB, external APIs.

**Integration (20%)**: Route handlers with real DB (test container). Verify: correct status codes, response shapes, DB state.

**E2E (10%)**: Full user flow — create account, create order, check order status. Run: nightly in CI, not on every commit.

**CI**: Unit + integration on every PR. E2E nightly. Fail the build on any test failure.
