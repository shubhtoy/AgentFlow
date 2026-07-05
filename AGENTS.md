# Agent Instructions for OpenCode

## Project Type
This is a **backend/server application** with various integrations. Prioritize:
- API design patterns
- Database optimization
- Caching strategies
- Security best practices

## MCP Servers

When you need to search documentation, use the available MCP tools:

- **context7** - Search live documentation for any library/framework
- **gh_grep** - Search code examples from GitHub
- **github** - Manage PRs, issues, and repository operations

## Usage Examples

```
Search the React docs for useEffect best practices. use context7
Find examples of Next.js API route handlers. use gh_grep
Create a PR for this feature. use github
```

## Skills

### Backend & System Design
- `backend-patterns` - API design, database optimization, caching
- `security-review` - Security checklist and patterns
- `tdd-workflow` - Test-driven development methodology
- `coding-standards` - TypeScript, Node.js best practices

### Frontend (if needed)
- `vercel-react-best-practices` - React/Next.js best practices
- `vercel-composition-patterns` - React composition patterns

## Backend Development Guidelines

When building server-side features:
1. Follow RESTful API conventions
2. Use proper error handling and logging
3. Implement caching where appropriate
4. Consider scalability and performance
5. Write tests first (use tdd-workflow skill)
6. Review security before implementing (use security-review skill)