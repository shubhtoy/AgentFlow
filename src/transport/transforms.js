'use strict';

// ── Passthrough transforms ──

function markdownPassthrough(content) {
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    if (content.rawContent) return content.rawContent;
    // Workflow object — use descriptor file content
    if (content.descriptorFile) return content.descriptorFile.rawContent || content.descriptorFile.content || '';
    // Primary file (node)
    if (content.primaryFile) return content.primaryFile.rawContent || content.primaryFile.content || '';
    if (content.content) return content.content;
  }
  return String(content || '');
}

function jsonPassthrough(content) {
  if (typeof content === 'string') return content;
  // Parsed file object — return raw content
  if (content && content.rawContent) return content.rawContent;
  return JSON.stringify(content, null, 2);
}

function ensureInstructionFrontmatter(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
  if (str.startsWith('---')) return str;
  return `---\ninclusion: manual\n---\n${str}`;
}

// ── Hooks → natural language instructions ──

/**
 * Convert hook definitions to a natural language instruction file.
 * Platforms that don't support hooks natively get these as readable
 * instructions the agent can follow manually or ask the user about.
 */
function hooksToInstructions(hooks) {
  if (typeof hooks === 'string') return hooks;
  const entries = Object.entries(hooks || {});
  if (entries.length === 0) return '';

  const lines = [
    '# Automation Rules',
    '',
    'These are automated behaviors from the original workspace.',
    'If your platform supports them natively, configure them.',
    'Otherwise, follow these rules manually or ask the user.',
    '',
  ];

  for (const [name, hook] of entries) {
    const h = typeof hook === 'object' ? hook : {};
    const event = h.event || 'unknown event';
    const action = h.action || {};
    const enabled = h.enabled !== false;

    if (!enabled) continue;

    lines.push(`## ${h.name || name}`);
    if (h.description) lines.push(h.description);
    lines.push('');

    // Translate event + action to plain language
    const eventDesc = {
      fileEdited: 'When a file is saved',
      fileCreated: 'When a new file is created',
      fileDeleted: 'When a file is deleted',
      'pre-commit': 'Before committing changes',
      'session-end': 'When the session ends',
    }[event] || `When "${event}" occurs`;

    const actionType = action.type || 'log';
    const target = action.target || '';
    let actionDesc = '';
    if (actionType === 'run-script' && target) {
      actionDesc = `run \`${target}\``;
    } else if (actionType === 'trigger-workflow' && target) {
      actionDesc = `trigger the "${target}" workflow`;
    } else if (actionType === 'notify') {
      actionDesc = 'notify the user';
    } else if (actionType === 'log') {
      actionDesc = 'log the event';
    } else {
      actionDesc = `perform: ${actionType}${target ? ' ' + target : ''}`;
    }

    lines.push(`**${eventDesc}**, ${actionDesc}.`);

    // Add condition details if present
    if (h.condition) {
      const c = h.condition;
      const field = c.field || 'path';
      const op = c.operator || 'matches';
      const val = c.value || '*';
      lines.push(`Only when ${field} ${op} \`${val}\`.`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ── Kiro-specific transforms ──

function mcpExtractServers(protocolsData) {
  if (typeof protocolsData === 'string') {
    try { protocolsData = JSON.parse(protocolsData); } catch { return '{}'; }
  }
  const servers = protocolsData?.mcpServers || protocolsData?.servers || protocolsData || {};
  return JSON.stringify({ mcpServers: servers }, null, 2);
}

function kiroMcpToProtocols(mcpContent) {
  const str = typeof mcpContent === 'string' ? mcpContent : JSON.stringify(mcpContent);
  let parsed;
  try { parsed = JSON.parse(str); } catch { return '{}'; }
  const servers = parsed.mcpServers || parsed.servers || {};
  return JSON.stringify({ mcpServers: servers }, null, 2);
}

function kiroInstructionsToIdentity(content) {
  const str = typeof content === 'string' ? content : (content?.rawContent || content?.content || '');
  const stripped = str.replace(/^---[\s\S]*?---\n?/, '');
  return `---\nname: imported-agent\nrole: assistant\n---\n${stripped}`;
}

function workflowToKiroSpec(workflow) {
  if (typeof workflow === 'string') return workflow;
  const name = workflow?.name || workflow?.id || 'workflow';
  const nodes = workflow?.nodes ? Object.entries(workflow.nodes) : [];
  let md = `# ${name}\n\n`;
  for (const [id, node] of nodes) {
    md += `## ${node.name || id}\n\n${node.description || ''}\n\n`;
  }
  return md;
}

function kiroSpecToWorkflow(specFiles) {
  if (typeof specFiles === 'string') return specFiles;
  const entries = Object.entries(specFiles || {});
  let md = '---\nname: imported-workflow\nentry: true\n---\n\n# Imported Workflow\n\n';
  for (const [name, content] of entries) {
    const text = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
    md += `## ${name}\n\n${text.slice(0, 200)}\n\n`;
  }
  return md;
}

// ── GitHub Copilot transforms ──

function identityToCopilotInstructions(agentsMd) {
  const content = typeof agentsMd === 'object' ? (agentsMd.rawContent || agentsMd.content || '') : String(agentsMd);
  return content.replace(/^---[\s\S]*?---\n?/, '');
}

function copilotInstructionsToIdentity(copilotMd) {
  const content = typeof copilotMd === 'string' ? copilotMd : String(copilotMd);
  return `---\nname: imported-agent\nrole: assistant\n---\n${content}`;
}

function workflowToCopilotInstructions(workflow) {
  if (typeof workflow === 'string') return workflow;
  const name = workflow?.name || workflow?.id || 'workflow';
  const desc = workflow?.description || '';
  const nodes = workflow?.nodes ? Object.entries(workflow.nodes) : [];
  const edges = workflow?.edges || [];
  const entry = (workflow?.entryPoints || [])[0] || (nodes[0] && nodes[0][0]) || '';

  const lines = [`# ${name}`, ''];
  if (desc) lines.push(desc, '');
  if (entry) lines.push(`Start at: **${entry}**`, '');

  lines.push('## Workflow Steps', '');
  for (const [id, node] of nodes) {
    const type = node.nodeType || 'step';
    const label = type === 'router' ? '(decision point)' : type === 'sub-workflow' ? '(sub-workflow)' : '';
    lines.push(`### ${node.name || id} ${label}`.trim());
    if (node.description) lines.push(node.description);

    const outgoing = edges.filter(e => e.from === id);
    if (outgoing.length > 0) {
      lines.push('');
      for (const e of outgoing) {
        const target = nodes.find(([nid]) => nid === e.to);
        const targetName = target ? (target[1].name || e.to) : e.to;
        if (e.condition) {
          lines.push(`- If ${e.condition}: go to **${targetName}**`);
        } else {
          lines.push(`- Then: **${targetName}**`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Claude Code transforms ──

function identityToClaudeMd(agentsMd) {
  const content = typeof agentsMd === 'object' ? (agentsMd.rawContent || agentsMd.content || '') : String(agentsMd);
  return content.replace(/^---[\s\S]*?---\n?/, '');
}

function claudeMdToIdentity(claudeMd) {
  const content = typeof claudeMd === 'string' ? claudeMd : String(claudeMd);
  return `---\ntype: agents\n---\n${content}`;
}

function mcpToClaudeSettings(protocolsData) {
  if (typeof protocolsData === 'string') {
    try { protocolsData = JSON.parse(protocolsData); } catch { return JSON.stringify({ mcpServers: {}, hooks: [] }, null, 2); }
  }
  const servers = protocolsData?.mcpServers || protocolsData?.servers || protocolsData || {};
  return JSON.stringify({ mcpServers: servers, hooks: [] }, null, 2);
}

function claudeSettingsToMcp(settingsJson) {
  const str = typeof settingsJson === 'string' ? settingsJson : JSON.stringify(settingsJson);
  let parsed;
  try { parsed = JSON.parse(str); } catch { return '{}'; }
  const servers = parsed.mcpServers || {};
  return JSON.stringify({ mcpServers: servers }, null, 2);
}

const SUPPLEMENTARY_ANNOTATION = '<!-- AgentFlow supplementary memory. This platform has native memory. Adjust prompts as needed. -->\n\n';

function annotateSupplementaryMemory(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content || '');
  return SUPPLEMENTARY_ANNOTATION + str;
}

function stripSupplementaryAnnotation(content) {
  const str = typeof content === 'string' ? content : String(content || '');
  return str.replace(/^<!--\s*AgentFlow supplementary memory\..*?-->\n?\n?/, '');
}

// ── LangGraph transforms ──

function identityToLanggraphSystemPrompt(agentsMd) {
  const content = typeof agentsMd === 'object' ? (agentsMd.rawContent || agentsMd.content || '') : String(agentsMd);
  const stripped = content.replace(/^---[\s\S]*?---\n?/, '').trim();
  return `"""Agent identity and system prompt."""\n\nSYSTEM_PROMPT = """${stripped}"""\n`;
}

function workflowToLanggraph(workflow) {
  if (typeof workflow === 'string') return workflow;
  const name = workflow?.name || workflow?.id || 'workflow';
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
  const nodes = workflow?.nodes ? Object.entries(workflow.nodes) : [];
  const edges = workflow?.edges || [];
  const entry = (workflow?.entryPoints || [])[0] || (nodes[0] && nodes[0][0]) || 'start';

  const lines = [
    '"""Auto-generated LangGraph workflow from AgentFlow."""',
    '', 'from typing import TypedDict', 'from langgraph.graph import StateGraph, END',
    '', '', 'class AgentState(TypedDict):', '    messages: list', '    current_step: str', '', '',
  ];

  for (const [id, node] of nodes) {
    const fnName = id.replace(/[^a-zA-Z0-9_]/g, '_');
    const desc = node.description || node.name || id;
    lines.push(`def ${fnName}(state: AgentState) -> AgentState:`);
    lines.push(`    """${desc}"""`);
    if ((node.nodeType || 'step') === 'router') {
      const outEdges = edges.filter(e => e.from === id);
      lines.push(`    # Router: ${outEdges.map(e => e.condition ? `${e.to} (${e.condition})` : e.to).join(', ')}`);
      lines.push(`    return {"current_step": "${outEdges[0]?.to || 'end'}"}`);
    } else {
      lines.push('    # TODO: implement step logic');
      lines.push('    return state');
    }
    lines.push('', '');
  }

  lines.push(`def build_${safeName}():`);
  lines.push(`    """Build the ${name} workflow graph."""`);
  lines.push('    graph = StateGraph(AgentState)', '');
  for (const [id] of nodes) lines.push(`    graph.add_node("${id}", ${id.replace(/[^a-zA-Z0-9_]/g, '_')})`);
  lines.push('', `    graph.set_entry_point("${entry}")`, '');
  for (const edge of edges) {
    if (edge.condition) lines.push(`    # Conditional: ${edge.condition}`);
    lines.push(`    graph.add_edge("${edge.from}", "${edge.to}")`);
  }
  const withOutgoing = new Set(edges.map(e => e.from));
  for (const [id] of nodes) { if (!withOutgoing.has(id)) lines.push(`    graph.add_edge("${id}", END)`); }
  lines.push('', '    return graph.compile()', '');
  return lines.join('\n');
}

function capabilityToLanggraphTool(capability) {
  const fm = typeof capability === 'object' ? (capability.frontmatter || {}) : {};
  const name = fm.name || 'tool';
  const desc = fm.description || '';
  const fnName = name.replace(/[^a-zA-Z0-9_]/g, '_');
  const params = fm.parameters || {};
  const paramEntries = Object.entries(params);

  const lines = ['"""Auto-generated tool stub from AgentFlow capability."""', '', 'from langchain_core.tools import tool', '', '', '@tool', `def ${fnName}(`];
  if (paramEntries.length > 0) {
    for (const [pName, pDef] of paramEntries) {
      lines.push(`    ${pName.replace(/[^a-zA-Z0-9_]/g, '_')}: ${(pDef && pDef.type === 'number') ? 'float' : 'str'},`);
    }
  } else {
    lines.push('    query: str,');
  }
  lines.push(`) -> str:`, `    """${desc}"""`, '    # TODO: implement tool logic', `    raise NotImplementedError("${fnName} not yet implemented")`, '');
  return lines.join('\n');
}

function mcpToLanggraphConfig(protocolsData) {
  if (typeof protocolsData === 'string') {
    try { protocolsData = JSON.parse(protocolsData); } catch { return '{}'; }
  }
  const servers = protocolsData?.mcpServers || protocolsData?.servers || protocolsData || {};
  const deps = ['langgraph', 'langchain', 'langchain_openai'];
  for (const cfg of Object.values(servers)) {
    if (cfg.command === 'npx' && cfg.args && cfg.args[1]) deps.push(`# MCP: ${cfg.args[1]}`);
  }
  return JSON.stringify({ dependencies: deps, graphs: { agent: './my_agent/agent.py:graph' }, env: './.env' }, null, 2);
}

// ── Cursor transforms ──

function mdToMdcAlways(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
  const stripped = str.replace(/^---[\s\S]*?---\n?/, '');
  return `---\nalwaysApply: true\n---\n${stripped}`;
}

function mdToMdcAgentRequested(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
  const stripped = str.replace(/^---[\s\S]*?---\n?/, '');
  const desc = stripped.split('\n')[0] || 'AgentFlow resource';
  return `---\nalwaysApply: false\ndescription: ${desc}\n---\n${stripped}`;
}

function mdcToMd(content) {
  const str = typeof content === 'string' ? content : String(content);
  return str.replace(/^---[\s\S]*?---\n?/, '');
}

function capabilityToMdc(content) {
  return mdToMdcAgentRequested(content);
}

function runbookToMdc(content) {
  return mdToMdcAgentRequested(content);
}

// ── Windsurf transforms ──

function identityToWindsurfRule(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
  const stripped = str.replace(/^---[\s\S]*?---\n?/, '');
  return `---\ntrigger: always_on\n---\n${stripped}`;
}

// ── Kiro steering transform ──

function identityToKiroSteering(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
  const stripped = str.replace(/^---[\s\S]*?---\n?/, '');
  return `---\ninclusion: auto\n---\n${stripped}`;
}

// ── Claude Code skill transforms ──

function instructionToClaudeSkill(content) {
  const str = typeof content === 'object' ? (content.rawContent || content.content || '') : String(content);
  const stripped = str.replace(/^---[\s\S]*?---\n?/, '');
  return stripped;
}

function claudeSkillToInstruction(content) {
  const str = typeof content === 'string' ? content : String(content);
  return `---\nscope: workflow\n---\n${str}`;
}

// ── Merge transforms ──

function instructionsAppendToClaudeMd(instructions) {
  if (typeof instructions === 'string') return instructions;
  const entries = Object.entries(instructions || {});
  if (!entries.length) return '';
  return entries.map(([name, data]) => {
    const str = typeof data === 'object' ? (data.rawContent || data.content || '') : String(data);
    return str.replace(/^---[\s\S]*?---\n?/, '');
  }).join('\n\n');
}

function instructionsToCopilotInstructions(instructions) {
  return instructionsAppendToClaudeMd(instructions);
}

// ── MCP transforms ──

function mcpRemap(content) {
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch { return '{}'; }
  }
  const servers = content?.mcpServers || content?.servers || content || {};
  return JSON.stringify({ mcpServers: servers }, null, 2);
}

function mcpReverse(content) {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  let parsed;
  try { parsed = JSON.parse(str); } catch { return '{}'; }
  return JSON.stringify({ mcpServers: parsed.mcpServers || parsed.servers || {} }, null, 2);
}

// ── Agent Spec transform (stub) ──

function graphToAgentSpec(_identity, graph) {
  const g = (graph && typeof graph === 'object') ? graph : {};
  const referenced = {};
  const agentspecVersion = '26.1.0';

  // ── Helpers ──
  function uid(prefix, name) {
    return `${prefix}_${name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function resourceContent(category, name, scope) {
    const res = (g[category] || {})[name];
    if (!res) return null;
    const raw = typeof res === 'string' ? res : (res.rawContent || res.content || '');
    const body = raw.replace(/^---[\s\S]*?---\n?/, '').trim();
    if (scope === 'signature') {
      // First non-empty line after frontmatter
      return body.split('\n').find(l => l.trim()) || body.slice(0, 120);
    }
    if (scope === 'summary') {
      // First paragraph
      return body.split('\n\n')[0].trim();
    }
    return body; // full
  }

  // ── Capabilities → ServerTools ──
  const capTools = {};
  for (const [capName, cap] of Object.entries(g.capabilities || {})) {
    const id = uid('tool', capName);
    const content = typeof cap === 'string' ? cap : (cap.content || cap.rawContent || '');
    const fm = (typeof cap === 'object' && cap.frontmatter) ? cap.frontmatter : {};
    referenced[id] = {
      component_type: 'ServerTool',
      id,
      name: fm.name || capName,
      description: fm.description || content.split('\n')[0].replace(/^#+\s*/, '').trim() || capName,
      inputs: [],
      outputs: [],
      requires_confirmation: false,
    };
    capTools[capName] = id;
  }

  // ── Workflows → Flows ──
  const flowIds = [];
  for (const [wfName, wf] of Object.entries(g.workflows || {})) {
    const nodes = wf.nodes || {};
    const edges = wf.edges || [];
    const entryPoints = wf.entryPoints || [];

    const conditionalEdges = edges.filter(e => e.condition);
    const routerNodeIds = new Set(conditionalEdges.map(e => e.from));

    const nodeAgentNodeIds = {};

    for (const [nodeId, node] of Object.entries(nodes)) {
      const fm = node.primaryFile?.frontmatter || {};
      // system_prompt = SKILL.md body with {{ref}} placeholders preserved
      // Agent Spec natively supports {{placeholder}} syntax — they become inputs
      const skillBody = (node.primaryFile?.content || node.primaryFile?.rawContent || '')
        .replace(/^---[\s\S]*?---\n?/, '').trim();

      // Build input Properties from context.inputs
      // Each ref (instructions/X, runbooks/X, memory/X, capabilities/X) becomes an input
      // with the resource content as default value (scoped appropriately)
      const contextInputs = node.contextBudget?.inputs || [];
      const inputProperties = contextInputs.map(inp => {
        const [cat, name] = inp.ref.split('/');
        const content = resourceContent(cat, name, inp.scope);
        const prop = {
          title: inp.ref.replace('/', '_'),
          type: 'string',
          description: `${inp.ref} (scope: ${inp.scope})`,
        };
        if (content) prop.default = content;
        return prop;
      });

      // Capability tools from allRefs
      const toolRefs = (node.allRefs || [])
        .filter(r => r.category === 'capabilities' && capTools[r.name])
        .map(r => ({ '$component_ref': capTools[r.name] }));

      const agentId = uid('agent', nodeId);
      referenced[agentId] = {
        component_type: 'Agent',
        id: agentId,
        name: fm.name || nodeId,
        description: fm.description || null,
        // system_prompt keeps {{ref}} placeholders — Agent Spec resolves them from inputs at runtime
        system_prompt: skillBody || `You are the ${fm.name || nodeId} agent.`,
        llm_config: {
          component_type: 'OpenAiCompatibleConfig',
          id: uid('llm', fm.model || 'default'),
          name: fm.model || 'default',
          model_id: fm.model || 'gpt-4o',
          url: 'https://api.openai.com/v1',
        },
        tools: toolRefs,
        toolboxes: [],
        human_in_the_loop: true,
        inputs: inputProperties,
        outputs: (node.outputDeclarations || []).map(o => ({
          title: o.name,
          type: 'string',
          description: o.description || null,
        })),
        // Preserve context budget metadata for fidelity
        metadata: {
          agentflow_context: {
            max_tokens: node.contextBudget?.max_tokens || null,
            exclude: node.contextBudget?.exclude || [],
            agent: fm.agent || null,
            nodeType: node.nodeType || 'step',
          },
        },
      };

      const outgoingCond = conditionalEdges.filter(e => e.from === nodeId);
      const branches = outgoingCond.length > 0
        ? [...new Set(outgoingCond.map(e => e.condition)), 'default']
        : ['next'];

      const agentNodeId = uid('node', nodeId);
      referenced[agentNodeId] = {
        component_type: 'AgentNode',
        id: agentNodeId,
        name: fm.name || nodeId,
        description: fm.description || null,
        agent: { '$component_ref': agentId },
        branches,
        inputs: inputProperties,
        outputs: (node.outputDeclarations || []).map(o => ({
          title: o.name,
          type: 'string',
          description: o.description || null,
        })),
      };
      nodeAgentNodeIds[nodeId] = agentNodeId;
    }

    // StartNode
    const startNodeId = uid('start', wfName);
    referenced[startNodeId] = {
      component_type: 'StartNode',
      id: startNodeId,
      name: 'start',
      description: null,
      inputs: [],
      outputs: [],
      branches: ['next'],
    };

    // EndNode
    const endNodeId = uid('end', wfName);
    referenced[endNodeId] = {
      component_type: 'EndNode',
      id: endNodeId,
      name: 'end',
      description: null,
      inputs: [],
      outputs: [],
      branches: [],
      branch_name: 'next',
    };

    // BranchingNodes for conditional edges
    const branchingNodeIds = {};
    for (const nodeId of routerNodeIds) {
      const condEdgesFromNode = conditionalEdges.filter(e => e.from === nodeId);
      const mapping = {};
      for (const e of condEdgesFromNode) mapping[e.condition] = e.condition;
      const branchNodeId = uid('branch', nodeId);
      referenced[branchNodeId] = {
        component_type: 'BranchingNode',
        id: branchNodeId,
        name: `branch_${nodeId}`,
        description: null,
        mapping,
        inputs: [{ title: 'branching_mapping_key', type: 'string' }],
        outputs: [],
        branches: [...Object.values(mapping), 'default'],
      };
      branchingNodeIds[nodeId] = branchNodeId;
    }

    // Control flow edges
    const controlEdges = [];
    const entryList = entryPoints.length > 0 ? entryPoints : Object.keys(nodes).slice(0, 1);
    for (const entryId of entryList) {
      const ceId = uid('ce', `start_${entryId}`);
      referenced[ceId] = {
        component_type: 'ControlFlowEdge',
        id: ceId,
        name: `start_to_${entryId}`,
        from_node: { '$component_ref': startNodeId },
        from_branch: null,
        to_node: { '$component_ref': nodeAgentNodeIds[entryId] || startNodeId },
      };
      controlEdges.push({ '$component_ref': ceId });
    }

    for (const edge of edges) {
      const fromNodeId = nodeAgentNodeIds[edge.from];
      const toNodeId = nodeAgentNodeIds[edge.to];
      if (!fromNodeId || !toNodeId) continue;

      if (edge.condition) {
        const toBranchId = branchingNodeIds[edge.from];
        if (toBranchId) {
          const ceId1 = uid('ce', `${edge.from}_to_branch`);
          if (!referenced[ceId1]) {
            referenced[ceId1] = {
              component_type: 'ControlFlowEdge',
              id: ceId1,
              name: `${edge.from}_to_branch`,
              from_node: { '$component_ref': fromNodeId },
              from_branch: null,
              to_node: { '$component_ref': toBranchId },
            };
            controlEdges.push({ '$component_ref': ceId1 });
          }
          const ceId2 = uid('ce', `branch_${edge.from}_${edge.condition}_${edge.to}`);
          referenced[ceId2] = {
            component_type: 'ControlFlowEdge',
            id: ceId2,
            name: `branch_${edge.condition}_to_${edge.to}`,
            from_node: { '$component_ref': toBranchId },
            from_branch: edge.condition,
            to_node: { '$component_ref': toNodeId },
          };
          controlEdges.push({ '$component_ref': ceId2 });
        }
      } else {
        const ceId = uid('ce', `${edge.from}_${edge.to}`);
        if (!referenced[ceId]) {
          referenced[ceId] = {
            component_type: 'ControlFlowEdge',
            id: ceId,
            name: `${edge.from}_to_${edge.to}`,
            from_node: { '$component_ref': fromNodeId },
            from_branch: null,
            to_node: { '$component_ref': toNodeId },
          };
          controlEdges.push({ '$component_ref': ceId });
        }
      }
    }

    // Data flow edges from {{<< output.nodeName}} refs
    const dataEdges = [];
    for (const [nodeId, node] of Object.entries(nodes)) {
      for (const ref of (node.allRefs || []).filter(r => r.semanticType === 'data_flow')) {
        const sourceNodeId = nodeAgentNodeIds[ref.name];
        const destNodeId = nodeAgentNodeIds[nodeId];
        if (!sourceNodeId || !destNodeId) continue;
        const deId = uid('de', `${ref.name}_to_${nodeId}`);
        if (!referenced[deId]) {
          referenced[deId] = {
            component_type: 'DataFlowEdge',
            id: deId,
            name: `${ref.name}_output_to_${nodeId}`,
            source_node: { '$component_ref': sourceNodeId },
            source_output: ref.name.replace(/-/g, '_') + '_output',
            destination_node: { '$component_ref': destNodeId },
            destination_input: ref.name.replace(/-/g, '_') + '_output',
          };
          dataEdges.push({ '$component_ref': deId });
        }
      }
    }

    // Terminal nodes → end
    const nodesWithOutgoing = new Set(edges.map(e => e.from));
    for (const termId of Object.keys(nodes).filter(id => !nodesWithOutgoing.has(id))) {
      const termNodeId = nodeAgentNodeIds[termId];
      if (!termNodeId) continue;
      const ceId = uid('ce', `${termId}_to_end`);
      referenced[ceId] = {
        component_type: 'ControlFlowEdge',
        id: ceId,
        name: `${termId}_to_end`,
        from_node: { '$component_ref': termNodeId },
        from_branch: null,
        to_node: { '$component_ref': endNodeId },
      };
      controlEdges.push({ '$component_ref': ceId });
    }

    const allNodeRefs = [
      { '$component_ref': startNodeId },
      ...Object.values(nodeAgentNodeIds).map(id => ({ '$component_ref': id })),
      ...Object.values(branchingNodeIds).map(id => ({ '$component_ref': id })),
      { '$component_ref': endNodeId },
    ];

    const flowId = uid('flow', wfName);
    const wfFm = wf.descriptorFile?.frontmatter || {};
    referenced[flowId] = {
      component_type: 'Flow',
      id: flowId,
      name: wfFm.name || wfName,
      description: wfFm.description || null,
      start_node: { '$component_ref': startNodeId },
      nodes: allNodeRefs,
      control_flow_connections: controlEdges,
      data_flow_connections: dataEdges.length > 0 ? dataEdges : null,
      inputs: [],
      outputs: [],
      // Hooks preserved in metadata — no native Agent Spec equivalent
      metadata: Object.keys(g.hooks || {}).length > 0 ? { agentflow_hooks: g.hooks } : undefined,
    };
    flowIds.push(flowId);
  }

  const output = {
    '$referenced_components': referenced,
    agentspec_version: agentspecVersion,
  };
  if (flowIds.length === 1) {
    output.component_type = 'Flow';
    output['$component_ref'] = flowIds[0];
  }

  return JSON.stringify(output, null, 2);
}


// ── Workflow transforms ──

function workflowToSkillDirs(workflow) {
  if (typeof workflow === 'string') return workflow;
  const name = workflow?.name || workflow?.id || 'workflow';
  const nodes = workflow?.nodes ? Object.entries(workflow.nodes) : [];
  let md = `# ${name}\n\n`;
  for (const [id, node] of nodes) {
    md += `## ${node.name || id}\n\n${node.description || ''}\n\n`;
  }
  return md;
}

function workflowToClaudeSkills(workflow) {
  return workflowToSkillDirs(workflow);
}

// ── Transform Registry ──

// ── Native hook transforms ──

/** Map AgentFlow event → Claude Code / VS Code Copilot event + matcher */
const AGENTFLOW_TO_CLAUDE_EVENT = {
  fileEdited:        { event: 'PostToolUse', matcher: 'Write|Edit' },
  fileCreated:       { event: 'PostToolUse', matcher: 'Write' },
  fileDeleted:       { event: 'PostToolUse', matcher: 'Bash' },
  preToolUse:        { event: 'PreToolUse', matcher: '*' },
  postToolUse:       { event: 'PostToolUse', matcher: '*' },
  workflowStarted:   { event: 'SessionStart', matcher: null },
  workflowCompleted: { event: 'Stop', matcher: null },
  workflowFailed:    { event: 'Stop', matcher: null },
  nodeEntered:       { event: 'PreToolUse', matcher: '*' },
  nodeCompleted:     { event: 'PostToolUse', matcher: '*' },
  memoryUpdated:     { event: 'PostToolUse', matcher: 'Write' },
  protocolToggled:   { event: 'PostToolUse', matcher: '*' },
};

/** Map AgentFlow event → Windsurf event */
const AGENTFLOW_TO_WINDSURF_EVENT = {
  fileEdited:        'post_write_code',
  fileCreated:       'post_write_code',
  fileDeleted:       'post_write_code',
  preToolUse:        'pre_run_command',
  postToolUse:       'post_run_command',
  workflowStarted:   'pre_user_prompt',
  workflowCompleted: 'post_cascade_response',
  workflowFailed:    'post_cascade_response',
  nodeEntered:       'pre_run_command',
  nodeCompleted:     'post_run_command',
  memoryUpdated:     'post_write_code',
  protocolToggled:   'post_mcp_tool_use',
};

/** Map AgentFlow action type → shell command */
function hookActionToCommand(hook) {
  const action = hook.action || {};
  switch (action.type) {
    case 'run-script': return action.target || 'echo "no target"';
    case 'trigger-workflow': return `echo "trigger: ${action.target || 'unknown'}"`;
    case 'notify': return `echo "${(action.params && action.params.message) || 'notification'}"`;
    case 'log': return `echo "[$(date -Iseconds)] ${hook.event}: ${hook.name}" >> .agentflow-hooks.log`;
    default: return `echo "hook: ${hook.name}"`;
  }
}

/** Parse hook entries from the hooks map (each value may be a parsed object or raw JSON) */
function parseHookEntries(hooks) {
  const entries = [];
  for (const [name, hook] of Object.entries(hooks || {})) {
    let h = hook;
    if (typeof h === 'string') { try { h = JSON.parse(h); } catch { continue; } }
    if (h && h.rawContent) { try { h = JSON.parse(h.rawContent); } catch { continue; } }
    if (h && h.enabled !== false) entries.push({ ...h, name: h.name || name });
  }
  return entries;
}

/**
 * hooks-to-claude-settings: AgentFlow hooks → .claude/settings.json hooks format
 * Also used by VS Code Copilot (same format) and Cursor (compatible)
 */
function hooksToClaudeSettings(hooks) {
  const entries = parseHookEntries(hooks);
  if (!entries.length) return null;
  const result = {};
  for (const hook of entries) {
    const mapping = AGENTFLOW_TO_CLAUDE_EVENT[hook.event];
    if (!mapping) continue;
    const { event, matcher } = mapping;
    if (!result[event]) result[event] = [];
    const group = { hooks: [{ type: 'command', command: hookActionToCommand(hook) }] };
    if (matcher) group.matcher = matcher;
    result[event].push(group);
  }
  return Object.keys(result).length ? JSON.stringify({ hooks: result }, null, 2) : null;
}

/**
 * hooks-to-windsurf: AgentFlow hooks → .windsurf/hooks.json format
 */
function hooksToWindsurf(hooks) {
  const entries = parseHookEntries(hooks);
  if (!entries.length) return null;
  const result = {};
  for (const hook of entries) {
    const event = AGENTFLOW_TO_WINDSURF_EVENT[hook.event];
    if (!event) continue;
    if (!result[event]) result[event] = [];
    result[event].push({ command: hookActionToCommand(hook), show_output: true });
  }
  return Object.keys(result).length ? JSON.stringify({ hooks: result }, null, 2) : null;
}

/**
 * hooks-to-openclaw: AgentFlow hooks → OpenClaw hooks/ directory files
 * Returns a map of { 'hooks/{name}/HOOK.md': content, 'hooks/{name}/handler.ts': content }
 * Since this is called per-hook via glob-transform, it returns a single HOOK.md
 */
function hooksToOpenclawHookMd(hook) {
  const h = typeof hook === 'string' ? (() => { try { return JSON.parse(hook); } catch { return null; } })()
    : (hook && hook.rawContent) ? (() => { try { return JSON.parse(hook.rawContent); } catch { return null; } })()
    : hook;
  if (!h) return '';
  const lines = [
    '---',
    `name: ${h.name || 'hook'}`,
    `event: ${h.event || 'command:new'}`,
    `enabled: ${h.enabled !== false}`,
    '---',
    '',
    `# ${h.name || 'Hook'}`,
    '',
    h.description || '',
    '',
    `**Event:** ${h.event}`,
    `**Action:** ${(h.action && h.action.type) || 'log'} → ${(h.action && h.action.target) || 'none'}`,
  ];
  if (h.condition) {
    lines.push(`**Condition:** ${h.condition.field} ${h.condition.operator} \`${h.condition.value}\``);
  }
  return lines.join('\n');
}

const TRANSFORMS = {
  'markdown-passthrough': markdownPassthrough,
  'json-passthrough': jsonPassthrough,
  'ensure-instruction-frontmatter': ensureInstructionFrontmatter,
  'hooks-to-instructions': hooksToInstructions,
  // Kiro
  'mcp-extract-servers': mcpExtractServers,
  'kiro-mcp-to-protocols': kiroMcpToProtocols,
  'kiro-instructions-to-identity': kiroInstructionsToIdentity,
  'workflow-to-kiro-spec': workflowToKiroSpec,
  'kiro-spec-to-workflow': kiroSpecToWorkflow,
  // GitHub Copilot
  'identity-to-copilot-instructions': identityToCopilotInstructions,
  'copilot-instructions-to-identity': copilotInstructionsToIdentity,
  'workflow-to-copilot-instructions': workflowToCopilotInstructions,
  // Claude Code
  'identity-to-claude-md': identityToClaudeMd,
  'claude-md-to-identity': claudeMdToIdentity,
  'mcp-to-claude-settings': mcpToClaudeSettings,
  'claude-settings-to-mcp': claudeSettingsToMcp,
  'annotate-supplementary-memory': annotateSupplementaryMemory,
  'strip-supplementary-annotation': stripSupplementaryAnnotation,
  // LangGraph
  'identity-to-langgraph-system-prompt': identityToLanggraphSystemPrompt,
  'workflow-to-langgraph': workflowToLanggraph,
  'capability-to-langgraph-tool': capabilityToLanggraphTool,
  'mcp-to-langgraph-config': mcpToLanggraphConfig,
  // Cursor
  'md-to-mdc-always': mdToMdcAlways,
  'md-to-mdc-agent-requested': mdToMdcAgentRequested,
  'mdc-to-md': mdcToMd,
  'capability-to-mdc': capabilityToMdc,
  'runbook-to-mdc': runbookToMdc,
  // Windsurf
  'identity-to-windsurf-rule': identityToWindsurfRule,
  // Kiro
  'identity-to-kiro-steering': identityToKiroSteering,
  // Claude Code skills
  'instruction-to-claude-skill': instructionToClaudeSkill,
  'claude-skill-to-instruction': claudeSkillToInstruction,
  'instructions-append-to-claude-md': instructionsAppendToClaudeMd,
  'instructions-to-copilot-instructions': instructionsToCopilotInstructions,
  'workflow-to-claude-skills': workflowToClaudeSkills,
  // MCP
  'mcp-remap': mcpRemap,
  'mcp-reverse': mcpReverse,
  // Agent Spec
  'graph-to-agent-spec': graphToAgentSpec,
  // Workflow
  'workflow-to-skill-dirs': workflowToSkillDirs,
  // Native hook transforms
  'hooks-to-claude-settings': hooksToClaudeSettings,
  'hooks-to-windsurf': hooksToWindsurf,
  'hooks-to-openclaw-hook-md': hooksToOpenclawHookMd,
};

function getTransform(name) {
  return TRANSFORMS[name] || null;
}

function listTransforms() {
  return Object.keys(TRANSFORMS);
}

module.exports = { TRANSFORMS, getTransform, listTransforms };
