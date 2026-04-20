/**
 * AgentFlow v2 — Validator Module
 *
 * Validates a parsed WorkflowGraph for structural errors, broken refs,
 * schema violations, cycles, unreachable nodes, and variable format.
 *
 * Permissive by default — schema violations, cycles, unreachable nodes,
 * and unknown category prefixes are warnings. Strict mode promotes them
 * to errors.
 */

const { resolveRef, RESERVED_DIRS } = require('./parser-core');

/* ------------------------------------------------------------------ */
/*  Schema Definitions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Each schema defines fields with:
 *   - type: 'string' | 'integer' | 'boolean' | 'object' | 'string[]'
 *   - required: true if always required
 *   - requiredWhen: { field, value } — conditionally required
 *   - enum: array of allowed values
 *   - default: default value (informational)
 *   - literal: exact value required
 */
const { getValidationSchema, resolveSchemaKey } = require('./schemas/frontmatter-schemas');

/* ── Validation schemas (derived from single source of truth) ──────── */
const SCHEMAS = {};
for (const type of ['agents', 'node', 'capability', 'instruction', 'runbook', 'memory']) {
  SCHEMAS[type] = getValidationSchema(type);
}
// No legacy aliases — canonical names only: capability, instruction, runbook

/* ------------------------------------------------------------------ */
/*  validateSchema                                                     */
/* ------------------------------------------------------------------ */

/**
 * Validate frontmatter against the schema for a given resource type.
 *
 * @param {Record<string, unknown>} frontmatter
 * @param {string} resourceType - One of the keys in SCHEMAS
 * @param {string} [filePath=''] - File path for error messages
 * @returns {{ filePath: string, field: string, message: string, resourceType: string }[]}
 */
function validateSchema(frontmatter, resourceType, filePath = '') {
  const errors = [];
  const schema = SCHEMAS[resourceType];
  if (!schema) return errors;

  const fm = frontmatter || {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = fm[field];

    // --- Check literal constraint ---
    if (rules.literal !== undefined) {
      if (value !== undefined && value !== rules.literal) {
        errors.push({
          filePath,
          field,
          message: `Expected literal value "${rules.literal}" but got "${value}"`,
          resourceType,
        });
      }
      continue; // literal fields don't need further checks
    }

    // --- Check required fields ---
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        filePath,
        field,
        message: `Missing required field "${field}"`,
        resourceType,
      });
      continue;
    }

    // --- Check conditionally required fields ---
    if (rules.requiredWhen) {
      const depField = rules.requiredWhen.field;
      const depValue = rules.requiredWhen.value;
      if (fm[depField] === depValue && (value === undefined || value === null || value === '')) {
        errors.push({
          filePath,
          field,
          message: `Field "${field}" is required when "${depField}" is "${depValue}"`,
          resourceType,
        });
        continue;
      }
    }

    // Skip further checks if value is absent (and not required)
    if (value === undefined || value === null) continue;

    // --- Type checks ---
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push({
        filePath,
        field,
        message: `Expected string for "${field}" but got ${typeof value}`,
        resourceType,
      });
    } else if (rules.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
      errors.push({
        filePath,
        field,
        message: `Expected integer for "${field}" but got ${typeof value === 'number' ? 'non-integer number' : typeof value}`,
        resourceType,
      });
    } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({
        filePath,
        field,
        message: `Expected boolean for "${field}" but got ${typeof value}`,
        resourceType,
      });
    } else if (rules.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      errors.push({
        filePath,
        field,
        message: `Expected object for "${field}" but got ${Array.isArray(value) ? 'array' : typeof value}`,
        resourceType,
      });
    } else if (rules.type === 'object[]') {
      if (!Array.isArray(value)) {
        errors.push({
          filePath,
          field,
          message: `Expected array of objects for "${field}" but got ${typeof value}`,
          resourceType,
        });
      } else if (value.some((v) => typeof v !== 'object' || v === null || Array.isArray(v))) {
        errors.push({
          filePath,
          field,
          message: `Expected all elements of "${field}" to be objects`,
          resourceType,
        });
      }
    } else if (rules.type === 'string[]') {
      if (!Array.isArray(value)) {
        errors.push({
          filePath,
          field,
          message: `Expected array of strings for "${field}" but got ${typeof value}`,
          resourceType,
        });
      } else if (value.some((v) => typeof v !== 'string')) {
        errors.push({
          filePath,
          field,
          message: `Expected all elements of "${field}" to be strings`,
          resourceType,
        });
      }
    }

    // --- Enum checks ---
    if (rules.enum && value !== undefined && value !== null) {
      if (!rules.enum.includes(value)) {
        errors.push({
          filePath,
          field,
          message: `Invalid value "${value}" for "${field}". Allowed: ${rules.enum.join(', ')}`,
          resourceType,
        });
      }
    }
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/*  detectCycles                                                       */
/* ------------------------------------------------------------------ */

/**
 * DFS-based cycle detection on a directed edge graph.
 *
 * @param {Array<{ id: string }>} nodes
 * @param {Array<{ from: string, to: string }>} edges
 * @returns {{ message: string, nodes: string[] }[]} Array of cycle warnings
 */
function detectCycles(nodes, edges) {
  const warnings = [];

  // Build adjacency list
  const adj = new Map();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge.to);
  }

  const WHITE = 0; // unvisited
  const GRAY = 1;  // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map();
  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  // Track the current DFS path for cycle reporting
  const pathStack = [];

  function dfs(nodeId) {
    color.set(nodeId, GRAY);
    pathStack.push(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (color.get(neighbor) === GRAY) {
        // Found a cycle — extract the cycle from pathStack
        const cycleStart = pathStack.indexOf(neighbor);
        const cycleNodes = pathStack.slice(cycleStart);
        warnings.push({
          type: 'cycle',
          message: `Cycle detected: ${cycleNodes.join(' → ')} → ${neighbor}`,
          nodes: cycleNodes,
        });
      } else if (color.get(neighbor) === WHITE) {
        dfs(neighbor);
      }
    }

    pathStack.pop();
    color.set(nodeId, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      dfs(node.id);
    }
  }

  return warnings;
}

/* ------------------------------------------------------------------ */
/*  findUnreachable                                                    */
/* ------------------------------------------------------------------ */

/**
 * Find nodes not reachable from any entry point via BFS.
 *
 * @param {Array<{ id: string }>} nodes
 * @param {Array<{ from: string, to: string }>} edges
 * @param {string[]} entryNodes - Node ids that are entry points
 * @returns {string[]} Array of unreachable node ids
 */
function findUnreachable(nodes, edges, entryNodes) {
  const entrySet = new Set(entryNodes || []);

  // If no entry points defined, treat all root nodes (no incoming edges) as entries
  // Even when entry points exist, root nodes (no incoming edges) are inherently reachable
  const hasIncoming = new Set();
  for (const edge of edges) hasIncoming.add(edge.to);
  for (const node of nodes) {
    if (!hasIncoming.has(node.id)) entrySet.add(node.id);
  }

  // BFS from all entry points
  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    if (adj.has(edge.from)) adj.get(edge.from).push(edge.to);
  }

  const visited = new Set();
  const queue = [...entrySet];
  for (const id of queue) visited.add(id);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of (adj.get(current) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return nodes
    .map((n) => n.id)
    .filter((id) => !visited.has(id));
}

/* ------------------------------------------------------------------ */
/*  validateVariables                                                  */
/* ------------------------------------------------------------------ */

/** Valid variable pattern: ${env:VARIABLE_NAME} */
const VALID_VAR_REGEX = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Broad pattern to catch any ${env:...} token (including malformed ones) */
const ALL_VAR_REGEX = /\$\{env:([^}]*)\}/g;

/**
 * Validate variable substitution tokens in content.
 * Valid format: ${env:VARIABLE_NAME} where VARIABLE_NAME is [A-Za-z_][A-Za-z0-9_]*
 *
 * @param {string} content
 * @returns {{ message: string, token: string }[]} Array of errors for malformed tokens
 */
function validateVariables(content) {
  if (!content || typeof content !== 'string') return [];

  const errors = [];

  // Collect all valid variable positions so we can skip them
  const validPositions = new Set();
  let match;

  VALID_VAR_REGEX.lastIndex = 0;
  while ((match = VALID_VAR_REGEX.exec(content)) !== null) {
    validPositions.add(match.index);
  }

  // Find all ${env:...} tokens and flag those not in validPositions
  ALL_VAR_REGEX.lastIndex = 0;
  while ((match = ALL_VAR_REGEX.exec(content)) !== null) {
    if (!validPositions.has(match.index)) {
      errors.push({
        message: `Malformed variable token: ${match[0]}`,
        token: match[0],
      });
    }
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/*  validate (main)                                                    */
/* ------------------------------------------------------------------ */

/**
 * Validate a WorkflowGraph. Returns errors, warnings, and a valid flag.
 *
 * In permissive mode (default):
 *   - Schema violations, cycles, unreachable nodes, unknown category → warnings
 * In strict mode:
 *   - All warnings become errors
 *
 * Always errors (regardless of mode):
 *   - Broken refs, invalid ref syntax, data flow to non-existent node,
 *     missing condition template, router with non-conditional edges,
 *     ambiguous name resolution, malformed variable tokens
 *
 * @param {object} graph - A WorkflowGraph from parseRoot()
 * @param {{ strict?: boolean }} [options={}]
 * @returns {{ errors: object[], warnings: object[], valid: boolean }}
 */
function validate(graph, options = {}) {
  const strict = options.strict || false;
  const hardErrors = [];
  const softIssues = []; // warnings in permissive, errors in strict

  if (!graph) {
    return { errors: [{ message: 'No graph provided' }], warnings: [], valid: false };
  }

  const allFiles = graph.allFiles || [];
  const workflows = graph.workflows || {};

  // --- 1. Schema validation for all typed files ---
  for (const file of allFiles) {
    const fm = file.frontmatter || {};
    const resourceType = file.resourceType;
    if (resourceType && SCHEMAS[resourceType]) {
      const schemaErrors = validateSchema(fm, resourceType, file.filePath || file.relativePath);
      for (const err of schemaErrors) {
        softIssues.push({ type: 'schema', ...err });
      }
    }
  }

  // --- 2. Validate refs across all workflows ---
  for (const wfKey of Object.keys(workflows)) {
    const wf = workflows[wfKey];
    const nodes = wf.nodes || {};
    const edges = wf.edges || [];

    // Collect all node ids for this workflow
    const nodeIds = new Set(Object.keys(nodes));

    // 2a. Check each edge for broken refs and conditions
    for (const edge of edges) {
      // Check if target node exists
      if (!nodeIds.has(edge.to)) {
        hardErrors.push({
          type: 'broken_ref',
          message: `Broken edge ref: target node "${edge.to}" not found in workflow "${wfKey}"`,
          filePath: edge.from,
          ref: `-> ${edge.to}`,
          workflow: wfKey,
        });
      }

      // Check if source node exists
      if (!nodeIds.has(edge.from)) {
        hardErrors.push({
          type: 'broken_ref',
          message: `Broken edge ref: source node "${edge.from}" not found in workflow "${wfKey}"`,
          filePath: edge.from,
          ref: `-> ${edge.to}`,
          workflow: wfKey,
        });
      }

      // Check missing condition template in conditional edges
      if (edge.condition) {
        const condRef = {
          category: edge.condition.split('/')[0] || '',
          name: edge.condition.split('/').slice(1).join('/') || '',
          semanticType: 'mention',
        };
        const resolved = resolveRef(condRef, graph);
        if (!resolved) {
          hardErrors.push({
            type: 'missing_condition',
            message: `Missing condition template "${edge.condition}" in conditional edge from "${edge.from}" to "${edge.to}"`,
            filePath: edge.from,
            ref: edge.condition,
            workflow: wfKey,
          });
        }
      }
    }

    // 2b. Check router nodes — all outgoing edges must be conditional
    //     AND router nodes must not have capabilities or instructions
    for (const [nodeId, node] of Object.entries(nodes)) {
      const nodeType = (node.frontmatter || {}).type || node.nodeType || 'step';
      if (nodeType === 'router') {
        const outgoing = edges.filter((e) => e.from === nodeId);
        for (const edge of outgoing) {
          if (!edge.condition) {
            softIssues.push({
              type: 'router_non_conditional',
              message: `Router node "${nodeId}" has non-conditional edge to "${edge.to}". Router edges should have conditions for deterministic routing.`,
              filePath: nodeId,
              ref: `-> ${edge.to}`,
              workflow: wfKey,
            });
          }
        }

        // Router nodes should not reference capabilities or instructions
        const allRefs = node.allRefs || [];
        const capRefs = allRefs.filter(r => r.category === 'capabilities' && r.semanticType === 'mention');
        const instrRefs = allRefs.filter(r => r.category === 'instructions' && r.semanticType === 'mention');
        if (capRefs.length > 0) {
          softIssues.push({
            type: 'router_has_capabilities',
            message: `Router node "${nodeId}" references capabilities (${capRefs.map(r => r.name).join(', ')}). Router nodes should only route — capabilities belong on step nodes.`,
            filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
            workflow: wfKey,
          });
        }
        if (instrRefs.length > 0) {
          softIssues.push({
            type: 'router_has_instructions',
            message: `Router node "${nodeId}" references instructions (${instrRefs.map(r => r.name).join(', ')}). Router nodes should only route — instructions belong on step nodes.`,
            filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
            workflow: wfKey,
          });
        }

        // Router nodes should have at least 2 outgoing edges
        if (outgoing.length < 2) {
          softIssues.push({
            type: 'router_single_exit',
            message: `Router node "${nodeId}" has ${outgoing.length} outgoing edge(s). Routers typically need at least 2 exits (e.g. approved/rejected).`,
            filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
            workflow: wfKey,
          });
        }
      }
    }

    // 2c. Check all refs in all node files for broken refs
    for (const [nodeId, node] of Object.entries(nodes)) {
      const allRefs = node.allRefs || [];
      for (const ref of allRefs) {
        // Check data flow refs to non-existent nodes
        if (ref.semanticType === 'data_flow') {
          const resolved = resolveRef(ref, graph);
          if (!resolved) {
            hardErrors.push({
              type: 'broken_data_flow',
              message: `Data flow ref to non-existent node "${ref.name}"`,
              filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
              ref: ref.raw,
              workflow: wfKey,
            });
          }
          continue;
        }

        // Check mention refs for broken targets
        if (ref.semanticType === 'mention') {
          const resolved = resolveRef(ref, graph);
          if (!resolved) {
            hardErrors.push({
              type: 'broken_ref',
              message: `Broken ref: target "${ref.category}/${ref.name}" not found`,
              filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
              ref: ref.raw,
              workflow: wfKey,
            });
          } else if (resolved.resolvedBy === 'ambiguous') {
            softIssues.push({
              type: 'ambiguous_ref',
              message: `Ambiguous ref "${ref.category}/${ref.name}" matches multiple files: ${resolved.matches.map((m) => m.filePath || m.relativePath).join(', ')}`,
              filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
              ref: ref.raw,
              workflow: wfKey,
            });
          }
        }
      }
    }

    // 2d. Detect cycles — informational only, not flagged as warnings.
    // Cycles are intentional in agent workflows (review gates, retry loops).
    // The detectCycles function is still exported for programmatic use.

    // 2e. Find unreachable nodes
    const nodeArray = Object.values(nodes);
    const entryPoints = wf.entryPoints || [];
    const unreachable = findUnreachable(nodeArray, edges, entryPoints);
    for (const nodeId of unreachable) {
      softIssues.push({
        type: 'unreachable',
        message: `Node "${nodeId}" may be unreachable (no incoming edges and not an entry node)`,
        nodes: [nodeId],
        workflow: wfKey,
      });
    }

    // 2e2. Validate exactly one entry point per workflow
    if (entryPoints.length === 0) {
      hardErrors.push({
        type: 'no_entry_point',
        message: `Workflow "${wfKey}" has no entry point. Exactly one node must have "entry: true" in frontmatter.`,
        workflow: wfKey,
      });
    } else if (entryPoints.length > 1) {
      hardErrors.push({
        type: 'multiple_entry_points',
        message: `Workflow "${wfKey}" has ${entryPoints.length} entry points (${entryPoints.join(', ')}). Exactly one is allowed.`,
        workflow: wfKey,
      });
    }

    // 2f. Validate context budget input refs exist
    for (const [nodeId, node] of Object.entries(nodes)) {
      const ctx = node.contextBudget;
      if (!ctx) continue;

      // Validate max_tokens is a positive integer if present
      if (ctx.max_tokens !== undefined) {
        if (typeof ctx.max_tokens !== 'number' || !Number.isInteger(ctx.max_tokens) || ctx.max_tokens <= 0) {
          softIssues.push({
            type: 'context_budget',
            message: `Node "${nodeId}" has invalid context.max_tokens: expected positive integer`,
            filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
            workflow: wfKey,
          });
        }
      }

      // Validate that context input refs resolve
      const inputs = ctx.inputs || [];
      for (const input of inputs) {
        if (!input.ref) continue;
        // Skip data flow refs (they start with <<)
        if (input.ref.startsWith('<<')) continue;

        // Build a ref-like object to resolve
        const parts = input.ref.split('/');
        const category = parts[0] || '';
        const name = parts.slice(1).join('/') || '';
        const fakeRef = { raw: input.ref, semanticType: 'mention', category, name };
        const resolved = resolveRef(fakeRef, graph);
        if (!resolved || !resolved.target) {
          softIssues.push({
            type: 'context_input_broken',
            message: `Node "${nodeId}" context input ref "${input.ref}" could not be resolved`,
            filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
            workflow: wfKey,
          });
        }

        // Validate scope value if present — any value is accepted,
        // common values are: full, metadata, summary, signature
      }

      // Warn if max_tokens exceeds recommended budget
      if (ctx.max_tokens && ctx.max_tokens > 8000) {
        softIssues.push({
          type: 'context_budget_high',
          message: `Node "${nodeId}" has context.max_tokens of ${ctx.max_tokens} which exceeds the recommended 8k budget. Consider splitting this node.`,
          filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
          workflow: wfKey,
        });
      }
    }

    // 2g. Validate output declarations
    for (const [nodeId, node] of Object.entries(nodes)) {
      const outputs = node.outputDeclarations;
      if (!outputs || !Array.isArray(outputs)) continue;

      for (const output of outputs) {
        if (!output.name) {
          softIssues.push({
            type: 'output_declaration',
            message: `Node "${nodeId}" has an output declaration without a "name" field`,
            filePath: node.primaryFile ? node.primaryFile.filePath : nodeId,
            workflow: wfKey,
          });
        }
        // Output format is freeform — any value is accepted.
        // Common formats: markdown, json, yaml, text, diff, csv, xml, html
      }
    }
  }

  // --- 3. Check for unknown category prefixes in all refs ---
  const knownCategories = new Set([...RESERVED_DIRS, 'nodes', 'output', 'workflows']);
  // Also add any workflow node directory names as known categories
  for (const wfKey of Object.keys(workflows)) {
    knownCategories.add(wfKey);
    const wf = workflows[wfKey];
    for (const nodeId of Object.keys(wf.nodes || {})) {
      knownCategories.add(nodeId);
    }
  }

  for (const file of allFiles) {
    const refs = file.refs || [];
    for (const ref of refs) {
      if (ref.category && !knownCategories.has(ref.category)) {
        // Check if the category matches any top-level directory in allFiles
        const categoryExists = allFiles.some((f) => {
          const rel = (f.relativePath || '').replace(/\\/g, '/');
          return rel.startsWith(ref.category + '/');
        });
        if (!categoryExists) {
          softIssues.push({
            type: 'unknown_category',
            message: `Unknown category prefix "${ref.category}" in ref "${ref.raw}"`,
            filePath: file.filePath || file.relativePath,
            ref: ref.raw,
          });
        }
      }
    }
  }

  // --- 4. Sub-workflow validation ---
  const workflowIds = new Set(Object.keys(workflows));

  for (const wfKey of Object.keys(workflows)) {
    const wf = workflows[wfKey];
    for (const [nodeId, node] of Object.entries(wf.nodes || {})) {
      if (node.nodeType !== 'sub-workflow') continue;
      const fm = node.primaryFile?.frontmatter || node.frontmatter || {};
      const linkedWf = fm.workflow;

      // 4a. Orphaned sub-workflow — empty workflow field
      if (!linkedWf) {
        softIssues.push({
          type: 'orphaned_sub_workflow',
          message: `Sub-workflow node "${nodeId}" has no linked workflow`,
          filePath: node.primaryFile?.filePath || node.primaryFile?.relativePath,
          workflow: wfKey,
        });
        continue;
      }

      // 4b. Missing target — workflow doesn't exist
      if (!workflowIds.has(linkedWf) && linkedWf !== nodeId) {
        softIssues.push({
          type: 'missing_sub_workflow_target',
          message: `Sub-workflow node "${nodeId}" links to workflow "${linkedWf}" which does not exist`,
          filePath: node.primaryFile?.filePath || node.primaryFile?.relativePath,
          ref: linkedWf,
          workflow: wfKey,
        });
      }

      // 4c. Self-referencing workflow (direct infinite loop)
      if (linkedWf === wfKey) {
        hardErrors.push({
          type: 'infinite_sub_workflow',
          message: `Sub-workflow node "${nodeId}" in workflow "${wfKey}" links back to its own workflow — infinite loop`,
          filePath: node.primaryFile?.filePath || node.primaryFile?.relativePath,
          workflow: wfKey,
        });
      }
    }
  }

  // 4d. Transitive infinite loop detection across sub-workflows
  // Build a graph: workflow → [linked workflows via sub-workflow nodes]
  const subWfEdges = new Map();
  for (const wfKey of Object.keys(workflows)) {
    const targets = [];
    const wf = workflows[wfKey];
    for (const node of Object.values(wf.nodes || {})) {
      if (node.nodeType === 'sub-workflow') {
        const linked = (node.primaryFile?.frontmatter || node.frontmatter || {}).workflow;
        if (linked && linked !== wfKey) targets.push(linked);
      }
    }
    if (targets.length) subWfEdges.set(wfKey, targets);
  }

  // DFS for transitive cycles
  function detectSubWfCycle(start) {
    const visited = new Set();
    const stack = [start];
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of (subWfEdges.get(current) || [])) {
        if (next === start) {
          hardErrors.push({
            type: 'infinite_sub_workflow',
            message: `Infinite sub-workflow loop: ${start} → ... → ${current} → ${start}`,
            workflow: start,
          });
          return;
        }
        stack.push(next);
      }
    }
  }
  for (const wfKey of subWfEdges.keys()) detectSubWfCycle(wfKey);

  // 4e. Validate {{workflows/X}} refs resolve to existing workflows
  for (const file of allFiles) {
    for (const ref of (file.refs || [])) {
      if (ref.category === 'workflows' && ref.name) {
        if (!workflowIds.has(ref.name)) {
          softIssues.push({
            type: 'unresolved_workflow_ref',
            message: `Workflow ref "{{workflows/${ref.name}}}" does not match any known workflow`,
            filePath: file.filePath || file.relativePath,
            ref: ref.raw,
          });
        }
      }
    }
  }

  // --- 5. Validate variable tokens in all file content ---
  for (const file of allFiles) {
    const content = file.rawContent || file.content || '';
    const varErrors = validateVariables(content);
    for (const ve of varErrors) {
      hardErrors.push({
        type: 'malformed_variable',
        message: ve.message,
        filePath: file.filePath || file.relativePath,
        token: ve.token,
      });
    }
    // Also check frontmatter string values for variable tokens
    const fm = file.frontmatter || {};
    for (const [key, val] of Object.entries(fm)) {
      if (typeof val === 'string') {
        const fmVarErrors = validateVariables(val);
        for (const ve of fmVarErrors) {
          hardErrors.push({
            type: 'malformed_variable',
            message: ve.message,
            filePath: file.filePath || file.relativePath,
            field: key,
            token: ve.token,
          });
        }
      }
    }
  }

  // --- 5. Validate workspace identity if present ---
  if (graph.identity) {
    const id = graph.identity;
    if (typeof id !== 'object' || Array.isArray(id)) {
      softIssues.push({
        type: 'identity',
        message: 'Workspace identity must be an object',
        filePath: graph.descriptorFile ? graph.descriptorFile.filePath : '',
      });
    } else {
      if (id.name && typeof id.name !== 'string') {
        softIssues.push({
          type: 'identity',
          message: 'Identity "name" must be a string',
          filePath: graph.descriptorFile ? graph.descriptorFile.filePath : '',
        });
      }
      if (id.role && typeof id.role !== 'string') {
        softIssues.push({
          type: 'identity',
          message: 'Identity "role" must be a string',
          filePath: graph.descriptorFile ? graph.descriptorFile.filePath : '',
        });
      }
      if (id.constraints && !Array.isArray(id.constraints)) {
        softIssues.push({
          type: 'identity',
          message: 'Identity "constraints" must be an array of strings',
          filePath: graph.descriptorFile ? graph.descriptorFile.filePath : '',
        });
      }
    }
  }

  // --- 6. Validate MCP tool references ---
  const mcpServers = graph.mcpServers;
  if (mcpServers && typeof mcpServers === 'object') {
    for (const file of allFiles) {
      const fm = file.frontmatter || {};
      if (fm.type !== 'mcp') continue;

      const serverName = fm.mcp;
      if (!serverName) continue;

      const serverExists = Object.prototype.hasOwnProperty.call(mcpServers, serverName);

      if (!serverExists) {
        // Warning: tool references a server not declared in mcp.json
        // Won't crash — the tool just won't be available at runtime
        softIssues.push({
          type: 'missing_mcp_server',
          message: `MCP tool "${fm.name || file.relativePath}" references server "${serverName}" which is not declared in mcp.json. The tool won't be available at runtime.`,
          filePath: file.filePath || file.relativePath,
          server: serverName,
        });

        // Additional warning for orphaned generated tool files
        if (fm.generated === true) {
          softIssues.push({
            type: 'orphaned_mcp_tool',
            message: `Orphaned MCP tool file "${fm.name || file.relativePath}" — server "${serverName}" was removed from mcp.json but generated tool file remains`,
            filePath: file.filePath || file.relativePath,
            server: serverName,
          });
        }
      }
    }
  }

  // --- 7. Warn about resource dirs inside workflow dirs ---
  const reservedSet = new Set(RESERVED_DIRS);
  const wfIds = new Set(Object.keys(workflows));
  for (const file of allFiles) {
    const parts = (file.relativePath || '').split('/');
    if (parts.length >= 3 && wfIds.has(parts[0]) && reservedSet.has(parts[1])) {
      softIssues.push({
        type: 'misplaced_resource',
        workflow: parts[0],
        dir: parts[1],
        file: file.relativePath,
        filePath: file.relativePath,
        message: `"${file.relativePath}" is inside workflow "${parts[0]}". Resources like ${parts[1]}/ should be at the top level to be shared across workflows.`,
      });
    }
  }

  // --- Assemble result ---
  if (strict) {
    // In strict mode, soft issues become errors
    const allErrors = [...hardErrors, ...softIssues];
    return {
      errors: allErrors,
      warnings: [],
      valid: allErrors.length === 0,
    };
  }

  return {
    errors: hardErrors,
    warnings: softIssues,
    valid: hardErrors.length === 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  // Schema definitions (useful for testing)
  SCHEMAS,

  // Core functions
  validateSchema,
  detectCycles,
  findUnreachable,
  validateVariables,
  validate,
};
