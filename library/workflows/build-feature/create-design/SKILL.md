---
name: create-design
type: step
description: Transform approved requirements into a detailed technical design
context:
  max_tokens: 8000
  inputs: [output.gather-requirements]
outputs:
  - name: design
    format: markdown
    description: Technical design with architecture, data models, API contracts, and testing strategy
---

# Create Design

Transform the approved requirements into a comprehensive technical design. Consume the requirements document from {{<< output.gather-requirements}} and produce an architecture that is simple, testable, and meets every stated constraint.

## Design Methodology

Follow {{instructions/technical-design}} for the overall design process. Every design decision must trace back to a specific requirement or constraint from the requirements document.

## Process

### 1. Understand the Problem Space

Read the requirements thoroughly. Identify:
- Core entities and their relationships
- Key workflows and state transitions
- Integration boundaries with external systems
- Performance-critical paths
- Security-sensitive operations

### 2. Explore Alternatives

Use {{skills/brainstorming}} to generate at least two viable architectural approaches before committing to one. For each alternative, document:
- High-level approach description
- Pros and cons
- Risk assessment
- Effort estimate

Do not skip this step. The first idea is rarely the best idea.

### 3. Choose Architecture

Select the approach that best balances simplicity, testability, and meeting requirements. Document the rationale for the choice and why alternatives were rejected.

Consider:
- Component boundaries and responsibilities
- Communication patterns (sync vs async, events vs direct calls)
- Error propagation strategy
- Deployment topology

### 4. Define Data Models

Specify the core data structures:
- Entity definitions with field types and constraints
- Relationships and cardinality
- Validation rules
- Migration strategy if modifying existing schemas

### 5. Specify API Contracts

Use {{skills/api-design}} to design clean, consistent API interfaces:
- Endpoint definitions with methods, paths, and parameters
- Request and response schemas
- Error response format and status codes
- Authentication and authorization requirements
- Rate limiting and pagination strategy

### 6. Plan Testing Strategy

Define how the implementation will be verified:
- Unit test boundaries — what gets mocked, what doesn't
- Integration test scenarios — which component interactions to test
- Edge cases derived from requirements constraints
- Performance test criteria if applicable

### 7. Record Decisions

Capture all significant architectural decisions in {{memory/decisions}} using the format:
- Decision: what was decided
- Context: why this decision was needed
- Alternatives: what else was considered
- Rationale: why this option was chosen

## Output

Produce a structured design document as `output.design` containing:
1. Architecture overview with component diagram
2. Data model definitions
3. API contracts
4. Testing strategy
5. Risks and mitigations
6. Decision log references

The design must be detailed enough that implementation can proceed without further architectural decisions.

{{-> review-design | design document is complete}}
