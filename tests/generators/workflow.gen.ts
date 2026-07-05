const fc = require('fast-check');
const { nameArb } = require('./refs.gen.ts');
const { descriptionArb } = require('./frontmatter.gen.ts');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a unique list of node IDs. */
function uniqueNodeIdsArb(count) {
  return fc
    .array(nameArb, { minLength: count, maxLength: count })
    .map((names) => {
      const seen = new Set();
      const ids = [];
      for (const name of names) {
        let id = name;
        let i = 1;
        while (seen.has(id)) {
          id = `${name}-${i++}`;
        }
        seen.add(id);
        ids.push(id);
      }
      return ids;
    });
}

/** Build a minimal ParsedFile stub for a node's primary file. */
function makeParsedFile(nodeId) {
  return {
    filePath: `workflow/${nodeId}/main.md`,
    relativePath: `${nodeId}/main.md`,
    frontmatter: {},
    title: nodeId,
    content: `# ${nodeId}`,
    rawContent: `# ${nodeId}`,
    refs: [],
    resourceType: 'node',
  };
}

/** Build a Ref stub for an edge. */
function makeEdgeRef(fromId, toId, condition) {
  const raw = condition
    ? `-> nodes/${toId} | templates/${condition}`
    : `-> nodes/${toId}`;
  return {
    raw,
    semanticType: 'edge',
    category: 'nodes',
    name: toId,
    condition: condition || undefined,
    offset: 0,
    line: 1,
  };
}

/** Build a NodeDef from an id and options. */
function makeNode(id, opts = {}) {
  const primaryFile = makeParsedFile(id);
  return {
    id,
    name: opts.name || id,
    description: opts.description,
    nodeType: opts.nodeType || 'step',
    entry: opts.entry || false,
    entryInferred: opts.entryInferred || false,
    primaryFile,
    contextFiles: [],
    allRefs: [],
    frontmatter: opts.frontmatter || {},
  };
}

/** Build an EdgeDef. */
function makeEdge(from, to, condition) {
  return {
    from,
    to,
    condition,
    sourceRef: makeEdgeRef(from, to, condition),
  };
}

// ─── Core workflow graph arbitrary ─────────────────────────────────────────

/**
 * workflowGraphArb — General-purpose workflow graph with 2-6 nodes.
 * Produces a WorkflowDef-like object with random edges between nodes.
 * Node types are randomly assigned (step or router).
 * Router nodes get conditional edges; step nodes get plain edges.
 */
const workflowGraphArb = fc
  .integer({ min: 2, max: 6 })
  .chain((nodeCount) =>
    fc
      .record({
        nodeIds: uniqueNodeIdsArb(nodeCount),
        workflowName: nameArb,
        nodeTypes: fc.array(
          fc.constantFrom('step', 'router'),
          { minLength: nodeCount, maxLength: nodeCount },
        ),
        descriptions: fc.array(
          fc.option(descriptionArb, { nil: undefined }),
          { minLength: nodeCount, maxLength: nodeCount },
        ),
        entryFlags: fc.array(fc.boolean(), {
          minLength: nodeCount,
          maxLength: nodeCount,
        }),
      })
      .chain(({ nodeIds, workflowName, nodeTypes, descriptions, entryFlags }) => {
        // Generate random edges: each node may have 0-2 outgoing edges
        const edgeArbs = nodeIds.map((fromId, idx) => {
          const otherIds = nodeIds.filter((id) => id !== fromId);
          if (otherIds.length === 0) return fc.constant([]);
          const isRouter = nodeTypes[idx] === 'router';
          return fc
            .array(
              fc.record({
                toIdx: fc.integer({ min: 0, max: otherIds.length - 1 }),
                condName: nameArb,
              }),
              { minLength: 0, maxLength: 2 },
            )
            .map((edgeSpecs) => {
              const seen = new Set();
              return edgeSpecs
                .filter(({ toIdx }) => {
                  if (seen.has(toIdx)) return false;
                  seen.add(toIdx);
                  return true;
                })
                .map(({ toIdx, condName }) =>
                  makeEdge(fromId, otherIds[toIdx], isRouter ? condName : undefined),
                );
            });
        });

        return fc.tuple(...edgeArbs).map((edgeArrays) => {
          const edges = edgeArrays.flat();
          const nodes = {};
          const entryPoints = [];

          for (let i = 0; i < nodeIds.length; i++) {
            const id = nodeIds[i];
            nodes[id] = makeNode(id, {
              nodeType: nodeTypes[i],
              description: descriptions[i],
              entry: entryFlags[i],
              frontmatter: nodeTypes[i] !== 'step' ? { type: nodeTypes[i] } : {},
            });
            if (entryFlags[i]) entryPoints.push(id);
          }

          // If no explicit entries, infer from no-incoming-edges
          if (entryPoints.length === 0) {
            const hasIncoming = new Set(edges.map((e) => e.to));
            for (const id of nodeIds) {
              if (!hasIncoming.has(id)) {
                nodes[id].entryInferred = true;
                entryPoints.push(id);
              }
            }
          }

          return {
            id: workflowName,
            name: workflowName,
            dir: workflowName,
            nodes,
            edges,
            entryPoints,
          };
        });
      }),
  );

// ─── Specialized arbitraries ──────────────────────────────────────────────────

/**
 * workflowWithCycleArb — Workflow guaranteed to contain at least one cycle.
 * Creates a chain A→B→C→...→A forming a cycle.
 */
const workflowWithCycleArb = fc
  .integer({ min: 2, max: 5 })
  .chain((cycleLen) =>
    fc
      .record({
        nodeIds: uniqueNodeIdsArb(cycleLen),
        workflowName: nameArb,
      })
      .map(({ nodeIds, workflowName }) => {
        const nodes = {};
        const edges = [];

        for (let i = 0; i < nodeIds.length; i++) {
          nodes[nodeIds[i]] = makeNode(nodeIds[i], { entry: i === 0 });
          // Edge to next node, wrapping around to form cycle
          const nextIdx = (i + 1) % nodeIds.length;
          edges.push(makeEdge(nodeIds[i], nodeIds[nextIdx]));
        }

        return {
          id: workflowName,
          name: workflowName,
          dir: workflowName,
          nodes,
          edges,
          entryPoints: [nodeIds[0]],
        };
      }),
  );

/**
 * workflowWithUnreachableArb — Workflow with at least one unreachable node.
 * Creates a connected chain plus one or more isolated nodes.
 */
const workflowWithUnreachableArb = fc
  .record({
    connectedCount: fc.integer({ min: 2, max: 4 }),
    unreachableCount: fc.integer({ min: 1, max: 2 }),
  })
  .chain(({ connectedCount, unreachableCount }) =>
    fc
      .record({
        nodeIds: uniqueNodeIdsArb(connectedCount + unreachableCount),
        workflowName: nameArb,
      })
      .map(({ nodeIds, workflowName }) => {
        const connectedIds = nodeIds.slice(0, connectedCount);
        const unreachableIds = nodeIds.slice(connectedCount);

        const nodes = {};
        const edges = [];

        // Build a linear chain for connected nodes
        for (let i = 0; i < connectedIds.length; i++) {
          nodes[connectedIds[i]] = makeNode(connectedIds[i], {
            entry: i === 0,
          });
          if (i < connectedIds.length - 1) {
            edges.push(makeEdge(connectedIds[i], connectedIds[i + 1]));
          }
        }

        // Add unreachable nodes (no incoming edges, not entry)
        for (const id of unreachableIds) {
          nodes[id] = makeNode(id, { entry: false, entryInferred: false });
        }

        return {
          id: workflowName,
          name: workflowName,
          dir: workflowName,
          nodes,
          edges,
          entryPoints: [connectedIds[0]],
          _unreachableIds: unreachableIds, // test helper
        };
      }),
  );

/**
 * workflowWithMultipleEntriesArb — Workflow with 2+ explicit entry points.
 */
const workflowWithMultipleEntriesArb = fc
  .record({
    entryCount: fc.integer({ min: 2, max: 4 }),
    extraCount: fc.integer({ min: 0, max: 3 }),
  })
  .chain(({ entryCount, extraCount }) =>
    fc
      .record({
        nodeIds: uniqueNodeIdsArb(entryCount + extraCount),
        workflowName: nameArb,
      })
      .map(({ nodeIds, workflowName }) => {
        const entryIds = nodeIds.slice(0, entryCount);
        const otherIds = nodeIds.slice(entryCount);

        const nodes = {};
        const edges = [];
        const entryPoints = [];

        for (const id of entryIds) {
          nodes[id] = makeNode(id, { entry: true });
          entryPoints.push(id);
        }

        for (const id of otherIds) {
          nodes[id] = makeNode(id, { entry: false });
        }

        // Wire each entry to a random non-entry node if available
        if (otherIds.length > 0) {
          for (const entryId of entryIds) {
            edges.push(makeEdge(entryId, otherIds[0]));
          }
        }

        return {
          id: workflowName,
          name: workflowName,
          dir: workflowName,
          nodes,
          edges,
          entryPoints,
        };
      }),
  );

/**
 * simpleLinearWorkflowArb — A simple linear chain: A → B → C → ...
 * Useful as a baseline for tests that need a predictable structure.
 */
const simpleLinearWorkflowArb = fc
  .integer({ min: 2, max: 6 })
  .chain((nodeCount) =>
    fc
      .record({
        nodeIds: uniqueNodeIdsArb(nodeCount),
        workflowName: nameArb,
      })
      .map(({ nodeIds, workflowName }) => {
        const nodes = {};
        const edges = [];

        for (let i = 0; i < nodeIds.length; i++) {
          nodes[nodeIds[i]] = makeNode(nodeIds[i], {
            entry: i === 0,
            entryInferred: false,
          });
          if (i < nodeIds.length - 1) {
            edges.push(makeEdge(nodeIds[i], nodeIds[i + 1]));
          }
        }

        return {
          id: workflowName,
          name: workflowName,
          dir: workflowName,
          nodes,
          edges,
          entryPoints: [nodeIds[0]],
        };
      }),
  );

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  workflowGraphArb,
  workflowWithCycleArb,
  workflowWithUnreachableArb,
  workflowWithMultipleEntriesArb,
  simpleLinearWorkflowArb,
  // Building blocks for composition in other generators
  makeNode,
  makeEdge,
  makeEdgeRef,
  makeParsedFile,
};
