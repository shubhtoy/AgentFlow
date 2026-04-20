/**
 * DeepAgent for the AgentFlow workspace copilot.
 *
 * Uses lib/runtime.ts for all context — mode, workspace root, keys, shell policy.
 * Dogfoods the AgentFlow format: reads .agentflow/ workflows and follows them.
 *
 * Backend filesystem = READ-ONLY (project-wide).
 * Writes go through CopilotKit frontend tools (createFile/editFile/deleteFile).
 *
 * IMPORTANT: Custom tools use LangChain's `tool()` (not CopilotKit's `defineTool`),
 * because DeepAgent expects DynamicStructuredTool instances.
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local', override: true })
loadEnv({ path: '.env', override: false })

import { createDeepAgent, FilesystemBackend, type SubAgent } from 'deepagents'
import { MemorySaver } from '@langchain/langgraph'
import { tool } from 'langchain'
import { z } from 'zod'
import { ctx as runtimeCtx, resolveKey, type Ctx } from '@/lib/runtime'
import { resolveModel, createChatModel } from '@/lib/copilot/model-registry'

// ─── Knowledge Base Tool — REMOVED ──────────────────────────────────
// AgentFlow knowledge is now inlined in the system prompt.
// Extended docs available via GitMCP at https://gitmcp.io/shubhtoy/agentflow/sse

// ─── Web Search Tool ─────────────────────────────────────────────────────

const webSearch = tool(
  async ({ query, maxResults }: { query: string; maxResults?: number }) => {
    const key = process.env.TAVILY_API_KEY
    if (!key) return JSON.stringify({ error: 'No TAVILY_API_KEY. Add it in Settings.' })
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query, max_results: maxResults ?? 5, search_depth: 'basic' }),
      })
      const data = await res.json()
      return JSON.stringify((data.results ?? []).map((r: any) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 300) })))
    } catch (e: any) { return JSON.stringify({ error: e.message }) }
  },
  {
    name: 'webSearch',
    description: 'Search the web for current information, docs, examples. Requires TAVILY_API_KEY.',
    schema: z.object({ query: z.string(), maxResults: z.number().optional().describe('Max results, default 5') }),
  }
)

// ─── Workflow Consumption Tools (dogfooding) ─────────────────────────────

const listWorkflows = tool(
  async () => {
    try {
      const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/data`)
      if (!res.ok) return JSON.stringify({ error: 'Failed to load workspace data' })
      const graph = await res.json()
      return JSON.stringify({
        name: graph.descriptorFile?.frontmatter?.name ?? null,
        identity: graph.descriptorFile?.frontmatter?.identity ?? null,
        workflows: Object.entries(graph.workflows ?? {}).map(([id, wf]: [string, any]) => ({
          id, name: wf.name, description: wf.description,
          entryPoints: wf.entryPoints,
          nodes: Object.entries(wf.nodes ?? {}).map(([nid, n]: [string, any]) => ({
            id: nid, name: n.name, type: n.nodeType, entry: n.entry,
            description: n.description,
            outgoingEdges: (wf.edges ?? [])
              .filter((e: any) => e.from === nid)
              .map((e: any) => ({ to: e.to, condition: e.condition ?? null })),
          })),
        })),
        resources: {
          capabilities: Object.keys(graph.capabilities ?? {}),
          instructions: Object.keys(graph.instructions ?? {}),
          runbooks: Object.keys(graph.runbooks ?? {}),
          memory: Object.keys(graph.memory ?? {}),
        },
      })
    } catch (e: any) { return JSON.stringify({ error: e.message }) }
  },
  {
    name: 'listWorkflows',
    description: 'List all workflows in the .agentflow/ workspace with their nodes, edges, and entry points. Use this to understand what workflows are available and pick one to follow.',
    schema: z.object({}),
  }
)

const activateNode = tool(
  async ({ workflowId, nodeId }: { workflowId: string; nodeId: string }) => {
    try {
      const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/data`)
      if (!res.ok) return JSON.stringify({ error: 'Failed to load workspace data' })
      const graph = await res.json()
      const wf = graph.workflows?.[workflowId]
      if (!wf) return JSON.stringify({ error: `Workflow "${workflowId}" not found` })
      const node = wf.nodes?.[nodeId]
      if (!node) return JSON.stringify({ error: `Node "${nodeId}" not found in workflow "${workflowId}"` })

      const resolvedRefs: Record<string, string> = {}
      for (const ref of node.allRefs ?? []) {
        if (ref.semanticType === 'mention') {
          const resource = graph[ref.category]?.[ref.name]
          if (resource?.rawContent) resolvedRefs[ref.raw] = resource.rawContent.slice(0, 2000)
        }
      }

      return JSON.stringify({
        workflowId, nodeId, name: node.name, type: node.nodeType,
        entry: node.entry, description: node.description,
        frontmatter: node.frontmatter,
        skillContent: node.primaryFile?.rawContent ?? null,
        edges: (wf.edges ?? [])
          .filter((e: any) => e.from === nodeId)
          .map((e: any) => ({ to: e.to, toName: wf.nodes?.[e.to]?.name, condition: e.condition ?? null })),
        resolvedRefs,
        contextConfig: node.frontmatter?.context ?? null,
      })
    } catch (e: any) { return JSON.stringify({ error: e.message }) }
  },
  {
    name: 'activateNode',
    description: 'Load a workflow node\'s full SKILL.md content, frontmatter, referenced resources, and outgoing edges. Call this when entering a new step in a workflow. The returned content IS your instructions for this step.',
    schema: z.object({
      workflowId: z.string().describe('Workflow ID (e.g. "build-feature")'),
      nodeId: z.string().describe('Node ID (e.g. "gather-requirements")'),
    }),
  }
)

// ─── Subagents ───────────────────────────────────────────────────────────

const subagents: SubAgent[] = [
  {
    name: 'validator',
    description: 'Validates .agentflow/ workspace — broken refs, missing entry points, schema issues.',
    systemPrompt: 'Check .agentflow/ files for structural issues. Report errors/warnings by severity. Suggest fixes.',
    tools: [],
  },
  {
    name: 'builder',
    description: 'Creates and edits .agentflow files following AgentFlow authoring conventions.',
    systemPrompt: 'You create and edit .agentflow/ files following AgentFlow conventions. Use frontend tools for writes.',
    tools: [],
  },
  {
    name: 'researcher',
    description: 'Searches the web and AgentFlow docs for patterns, examples, and best practices.',
    systemPrompt: 'You research AgentFlow patterns. Use webSearch for external info and MCP for AgentFlow docs.',
    tools: [],
  },
  {
    name: 'reviewer',
    description: 'Reviews workspace against requirements. Checks completeness, correctness, token budgets.',
    systemPrompt: 'You review .agentflow/ workspaces for quality. Check refs, types, conditions, budgets, naming.',
    tools: [],
  },
]

// ─── System Prompt ───────────────────────────────────────────────────────

function buildSystemPrompt(c: Ctx): string {
  const shell = c.shellEnabled ? '- Shell: execute (requires user approval)' : '- Shell: DISABLED (online mode)'

  return `You are Flow — the AI assistant for AgentFlow Studio.

## Core Behavior: Workflow-Driven (Dogfooding)

You are YOURSELF an AgentFlow agent. The workspace you operate on contains .agentflow/ workflows
that define how you should work. When a user asks you to do something complex:

1. Call listWorkflows to see what workflows are available
2. Pick the best workflow for the task (e.g. "build-feature" for new features, "interactive-assistant" for exploration)
3. Call activateNode on the entry point node — its SKILL.md content IS your instructions
4. Follow the SKILL.md instructions exactly — it tells you what to do, what tools to use, what to output
5. When done with a node, check its outgoing edges and follow the appropriate one
6. For router nodes: classify the situation and pick the matching conditional edge
7. For review gates: present results to the user and wait for approval before proceeding
8. Continue until the workflow completes

If no workflow matches the user's request, fall back to freeform mode using your general capabilities.

## AgentFlow Format Reference

### Workspace Structure
\`\`\`
.agentflow/
  AGENTS.md              ← Identity + workflow discovery (Layer 0)
  mcp.json               ← MCP server configuration (optional)
  capabilities/          ← Tool definitions: builtin, script, MCP
  instructions/          ← Reusable instruction modules
  runbooks/              ← Routing conditions + human touchpoints
  memory/                ← Persistent state across sessions
  hooks/                 ← Event-driven automation (JSON)
  <workflow>/
    AGENTS.md            ← Workflow descriptor + node summaries (Layer 1)
    <node>/
      SKILL.md           ← Stage contract + instructions (Layer 2)
\`\`\`

### AGENTS.md Frontmatter
\`\`\`yaml
---
type: agents
name: your-workspace
description: One-sentence purpose
identity:
  name: Agent Name
  role: What it does
  personality: How it behaves
  constraints:
    - Hard rules
---
\`\`\`
Body: workflows as \`{{-> nodes/...}}\` refs, capabilities, instructions, memory refs.

### SKILL.md Frontmatter
\`\`\`yaml
---
name: gather-requirements
type: step                    # step | router | sub-workflow
entry: true                   # exactly 1 per workflow
agent: requirements-analyst   # optional persona
model: claude-sonnet          # optional preferred model
context:
  max_tokens: 3000
  inputs:
    - ref: instructions/requirements-elicitation
      scope: full             # full | summary | signature
    - ref: capabilities/read-code
      scope: signature
outputs:
  - name: requirements-doc
    format: markdown
---
\`\`\`

### Reference Syntax
- \`{{capabilities/read-code}}\` — mention: load resource as context
- \`{{instructions/code-search}}\` — mention: load instruction
- \`{{-> nodes/create-design}}\` — edge: go here next
- \`{{-> nodes/plan-tasks | runbooks/design-approved}}\` — conditional edge
- \`{{<< output.gather-requirements}}\` — data flow: read output from previous node

### Node Types
| Type | Purpose | Has capabilities? | Has instructions? |
|------|---------|-------------------|-------------------|
| step | Does work | Yes | Yes |
| router | Routes only | NO | NO |
| sub-workflow | Delegates | Inherited | Inherited |

### Capability Types
Builtin: \`type: builtin, builtin_mapping: readCode\`
Script: \`type: script, command: npm test\`
MCP: \`type: mcp, mcp: server-name\` (must match key in mcp.json)

### Runbook Types
Condition: \`type: condition, check: "The user approved the design"\`
Interaction: \`type: approval | freeform | choice | confirm\`

### Hook Format (JSON)
Events: fileEdited, fileCreated, fileDeleted, preToolUse, postToolUse, workflowStarted, workflowCompleted, nodeEntered, nodeCompleted, memoryUpdated, session-end
Actions: trigger-workflow, run-script, notify, log

### Memory Format
Files: MEMORY.md, user.md, decisions.md, facts.md, lessons.md
Rules: date-prefix entries [YYYY-MM-DD], be specific, never store secrets.

### Graph Patterns
Linear: req → design → tasks → implement → verify
Review gates: req → gate → design → gate → tasks
Rejection loops: gate --rejected--> req (revise)
Iteration: implement → gate --more--> implement, gate --done--> verify

### Token Estimation
~1 token ≈ 4 chars. Root AGENTS.md ~200 tok. Node SKILL.md ~1-3k tok. Split if >8k.

### Validation Rules
Errors: broken_ref, broken_data_flow, missing_condition, no_entry_point, multiple_entry_points
Warnings: router_non_conditional, router_has_capabilities, ambiguous_ref, missing_mcp_server, unreachable, context_budget_high

### Builder Patterns
single · supervisor · router · handoff · pipeline · blackboard

## Environment
Mode: ${c.mode} | Workspace: ${c.workspaceRoot}
${c.mode === 'online' ? 'Online mode — no shell, session-scoped workspace.' : ''}

## Tools
- Workflow: listWorkflows (discover), activateNode (load step instructions + edges)
- Read: ls, read_file, glob, grep
- Write: createFile, editFile, deleteFile (frontend — updates UI live)
- Search: webSearch (web info)
- Plan: write_todos
- Subagents: task (validator, builder, researcher, reviewer)
${shell}
- UI: selectNode, focusNode, switchWorkflow, selectResource, setTheme
- Validate: validateWorkspace, calculateTokens
- Library: addFromLibrary
- Memory: readMemory, writeMemory
- MCP: AgentFlow docs (GitMCP) + user-configured servers

## Rules
- ALWAYS check for a matching workflow before going freeform
- When following a workflow, read the SKILL.md — don't improvise
- Follow edges one step at a time — never load all nodes at once
- Use RELATIVE paths only
- Read before editing
- Validate after changes
- Ask before deleting or bulk changes
- Write to memory after significant decisions
- Be concise
`
}

// ─── Agent Factory ───────────────────────────────────────────────────────

const cache = new Map<string, { graph: any; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000

async function buildAgent(sessionId: string) {
  const c = runtimeCtx(sessionId)
  const model = await createChatModel(resolveModel(sessionId), { temperature: 0.3, sessionId })

  return createDeepAgent({
    model,
    systemPrompt: buildSystemPrompt(c),
    tools: [webSearch, listWorkflows, activateNode],
    backend: new FilesystemBackend({ rootDir: c.workspaceRoot }),
    subagents,
    interruptOn: {
      read_file: false, ls: false, glob: false, grep: false,
      write_todos: false, task: false,
      write_file: { allowedDecisions: ['reject'] },
      edit_file: { allowedDecisions: ['reject'] },
      execute: c.shellEnabled
        ? { allowedDecisions: ['approve', 'edit', 'reject'] }
        : { allowedDecisions: ['reject'] },
    },
    checkpointer: new MemorySaver(),
  })
}

async function getAgent(sessionId: string) {
  const cached = cache.get(sessionId)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.graph
  const g = await buildAgent(sessionId)
  cache.set(sessionId, { graph: g, ts: Date.now() })
  return g
}

// ─── Export ──────────────────────────────────────────────────────────────

export const graph = getAgent('default')
export { getAgent }
