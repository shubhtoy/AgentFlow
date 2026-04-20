---
type: instruction
name: technical-design
scope: workflow
domain: software-architecture
description: Structured approach to creating technical design documents from requirements
tags:
  - design
  - architecture
  - api
  - data-models
narrativeTemplate:
  prefix: "Apply"
  suffix: "to create the technical design"
---

# Technical Design

Transform validated requirements into a concrete technical design with architecture decisions, data models, API contracts, and component interfaces.

## Process

### 1. Architecture Overview
- Draw the system context — what components exist, how they interact
- Identify which components need changes vs. new components
- Map the data flow end-to-end for each user story

### 2. Component Design
For each component that needs changes:
- Define the public interface (functions, methods, API endpoints)
- Specify input/output types with full type definitions
- Document error handling strategy
- Note performance considerations

### 3. Data Model Design
- Define new types, interfaces, or database schemas
- Show relationships between entities
- Document constraints and validation rules
- Consider migration strategy for existing data

### 4. API Contract Design
For each new or modified API endpoint:
- HTTP method and path
- Request body schema with types and validation
- Response body schema for success and error cases
- Authentication and authorization requirements

### 5. Integration Points
- How does this feature integrate with existing code?
- What existing functions/modules need modification?
- Are there breaking changes? How are they handled?

### 6. Testing Strategy
- What unit tests are needed?
- What integration tests are needed?
- What are the key correctness properties?

## Rules
- Every design decision should trace back to a requirement
- Prefer composition over inheritance
- Design for testability — no hidden dependencies
- Document what you considered AND what you rejected (and why)
