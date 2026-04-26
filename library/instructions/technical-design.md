---
name: technical-design
description: Structured approach to creating technical design documents from requirements
domain: software-architecture
tags:
  - design
  - architecture
  - api
  - data-models
---

# Technical Design

Transform validated requirements into a concrete technical design with architecture decisions, data models, API contracts, and component interfaces.

## Process

### 1. Architecture Overview
- Draw the system context — what components exist, how they interact
- Identify which components need changes vs. new components
- Map the data flow end-to-end for each user story
- Document the deployment topology and infrastructure requirements
- Identify cross-cutting concerns: logging, auth, error handling, monitoring

### 2. Component Design
For each component that needs changes:
- Define the public interface (functions, methods, API endpoints)
- Specify input/output types with full type definitions
- Document error handling strategy and failure modes
- Note performance considerations and scaling limits
- Define the component's dependencies and what it depends on

### 3. Data Model Design
- Define new types, interfaces, or database schemas
- Show relationships between entities (1:1, 1:N, N:M)
- Document constraints and validation rules
- Consider migration strategy for existing data
- Plan for backward compatibility if schemas change

### 4. API Contract Design
For each new or modified API endpoint:
- HTTP method and path (or RPC method signature)
- Request body schema with types and validation rules
- Response body schema for success and error cases
- Authentication and authorization requirements
- Rate limiting and pagination strategy

### 5. Integration Points
- How does this feature integrate with existing code?
- What existing functions/modules need modification?
- Are there breaking changes? How are they handled?
- What feature flags or gradual rollout mechanisms are needed?

### 6. Testing Strategy
- What unit tests are needed for new logic?
- What integration tests verify component interactions?
- What are the key correctness properties to assert?
- What edge cases and failure scenarios need coverage?

## Rules
- Every design decision should trace back to a requirement
- Prefer composition over inheritance
- Design for testability — no hidden dependencies
- Document what you considered AND what you rejected (and why)
- Keep the design as simple as possible — complexity is a cost
- If a decision is reversible, note that — it reduces the stakes
