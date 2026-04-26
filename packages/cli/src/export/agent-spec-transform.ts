/**
 * Agent Spec Transform — AgentFlow ParsedGraph → Agent Spec JSON (v26.1.0)
 *
 * Builds the JSON directly following the Oracle Agent Spec schema.
 * When tsagentspec is vendored, this can be replaced with type-safe builders.
 */

import type {
  ParsedGraph,
  ParsedWorkflow,
  ParsedNode,
  Edge,
  ParsedFile,
} from '@agentflow/core/parser-core'

// ── Types ──────────────────────────────────────────────────────────────

interface AgentSpecComponent {
  component_type: string
  name: string
  description?: string
  [key: string]: unknown
}

interface AgentSpecOutput {
  agentspec_version: string
  $referenced_components: Record<string, AgentSpecComponent>
  flows: Record<string, unknown>
}

type ToolType = 'ServerTool' | 'ClientTool' | 'MCPTool' | 'BuiltinTool'

// ── Main transform ─────────────────────────────────────────────────────

export function toAgentSpec(graph: ParsedGraph): AgentSpecOutput {
  const components: Record<string, AgentSpecComponent> = {}
  const flows: Record<string, unknown> = {}

  // Build tools from capabilities
  for (const [name, cap] of Object.entries(graph.capabilities)) {
    const toolType = mapToolType(cap.toolType)
    const tool: AgentSpecComponent = {
      component_type: toolType,
      name,
      description: (cap.frontmatter?.description as string) || '',
    }
    if (toolType === 'ServerTool' && cap.command) {
      tool.command = cap.command
    }
    if (toolType === 'MCPTool' && cap.mcp) {
      tool.mcp_server = cap.mcp
    }
    if (toolType === 'ClientTool' && cap.package) {
      tool.package = cap.package
    }
    if (toolType === 'BuiltinTool' && cap.builtinMapping) {
      tool.builtin_mapping = cap.builtinMapping
    }
    if (cap.parameters) {
      tool.parameters = cap.parameters
    }
    components[`tool:${name}`] = tool
  }

  // Build flows from workflows
  for (const [wfId, wf] of Object.entries(graph.workflows)) {
    flows[wfId] = buildFlow(wf, graph, components)
  }

  return {
    agentspec_version: '26.1.0',
    $referenced_components: components,
    flows,
  }
}

// ── Flow builder ───────────────────────────────────────────────────────

function buildFlow(
  wf: ParsedWorkflow,
  graph: ParsedGraph,
  components: Record<string, AgentSpecComponent>,
): unknown {
  const nodes: Record<string, unknown> = {}
  const controlFlowEdges: unknown[] = []

  // StartNode
  nodes['__start__'] = {
    node_type: 'StartNode',
    name: '__start__',
  }

  // EndNode
  nodes['__end__'] = {
    node_type: 'EndNode',
    name: '__end__',
  }

  // Build agent nodes
  for (const [nodeId, node] of Object.entries(wf.nodes)) {
    if (node.isRouter) {
      // Router → BranchingNode
      nodes[nodeId] = buildBranchingNode(node, wf.edges)
    } else if (node.nodeType === 'sub-workflow') {
      nodes[nodeId] = buildFlowNode(node)
    } else {
      const agent = buildAgent(node, graph, components)
      components[`agent:${wf.id}:${nodeId}`] = agent
      nodes[nodeId] = {
        node_type: 'AgentNode',
        name: node.name,
        description: node.description || undefined,
        agent: { $ref: `agent:${wf.id}:${nodeId}` },
        outputs: node.outputDeclarations || undefined,
      }
    }
  }

  // Entry edges: StartNode → entry points
  for (const ep of wf.entryPoints) {
    controlFlowEdges.push({
      edge_type: 'ControlFlowEdge',
      source: '__start__',
      target: ep,
      branch: 'default',
    })
  }

  // Build edges
  const terminalNodes = findTerminalNodes(wf)
  for (const edge of wf.edges) {
    if (edge.condition) {
      // Conditional edges are handled by BranchingNode
      controlFlowEdges.push({
        edge_type: 'ControlFlowEdge',
        source: edge.from,
        target: edge.to,
        branch: edge.condition,
      })
    } else {
      controlFlowEdges.push({
        edge_type: 'ControlFlowEdge',
        source: edge.from,
        target: edge.to,
        branch: 'default',
      })
    }
  }

  // Terminal → EndNode
  for (const tid of terminalNodes) {
    controlFlowEdges.push({
      edge_type: 'ControlFlowEdge',
      source: tid,
      target: '__end__',
      branch: 'default',
    })
  }

  // Data flow edges
  const dataFlowEdges: unknown[] = []
  for (const node of Object.values(wf.nodes)) {
    for (const ref of node.allRefs) {
      if (ref.semanticType === 'data_flow' && ref.name) {
        let sourceName = ref.name
        if (sourceName.startsWith('output.')) sourceName = sourceName.slice(7)
        dataFlowEdges.push({
          edge_type: 'DataFlowEdge',
          source_node: sourceName,
          target_node: node.id,
          data_key: ref.name,
        })
      }
    }
  }

  return {
    component_type: 'Flow',
    name: wf.name,
    description: wf.description || undefined,
    nodes,
    control_flow_connections: controlFlowEdges,
    data_flow_connections: dataFlowEdges.length ? dataFlowEdges : undefined,
  }
}

// ── Node builders ──────────────────────────────────────────────────────

function buildAgent(
  node: ParsedNode,
  graph: ParsedGraph,
  _components: Record<string, AgentSpecComponent>,
): AgentSpecComponent {
  const promptParts: string[] = []

  // L0 — workspace identity
  if (graph.descriptorFile?.content) {
    promptParts.push(graph.descriptorFile.content)
  }

  // L2 — node primary file body
  if (node.primaryFile.content) {
    promptParts.push(node.primaryFile.content)
  }

  // Context files
  for (const cf of node.contextFiles) {
    if (cf.content) promptParts.push(cf.content)
  }

  // Collect tool refs
  const tools: { $ref: string }[] = []
  for (const ref of node.allRefs) {
    if (ref.semanticType === 'mention' && ref.category === 'capabilities') {
      tools.push({ $ref: `tool:${ref.name}` })
    }
  }

  const agent: AgentSpecComponent = {
    component_type: 'Agent',
    name: node.frontmatter?.agent as string || node.name,
    description: node.description || undefined,
    system_prompt: promptParts.join('\n\n'),
  }
  if (node.frontmatter?.model) {
    agent.model = node.frontmatter.model
  }
  if (tools.length) {
    agent.tools = tools
  }
  return agent
}

function buildBranchingNode(
  node: ParsedNode,
  edges: Edge[],
): unknown {
  const branches = edges
    .filter((e) => e.from === node.id && e.condition)
    .map((e) => ({
      branch: e.condition,
      target: e.to,
    }))

  return {
    node_type: 'BranchingNode',
    name: node.name,
    description: node.description || undefined,
    branches,
  }
}

function buildFlowNode(node: ParsedNode): unknown {
  return {
    node_type: 'FlowNode',
    name: node.name,
    description: node.description || undefined,
    workflow: node.frontmatter?.workflow || undefined,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function mapToolType(type?: string): ToolType {
  switch (type) {
    case 'script': return 'ServerTool'
    case 'package': return 'ClientTool'
    case 'mcp': return 'MCPTool'
    case 'builtin': return 'BuiltinTool'
    default: return 'BuiltinTool'
  }
}

function findTerminalNodes(wf: ParsedWorkflow): string[] {
  const sources = new Set(wf.edges.map((e) => e.from))
  return Object.keys(wf.nodes).filter((id) => !sources.has(id))
}
