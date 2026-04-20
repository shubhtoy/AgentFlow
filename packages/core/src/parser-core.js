/**
 * AgentFlow Parser — Core utilities (browser-safe, zero Node.js deps).
 *
 * Shared by parser.js (Node) and parser-browser.js (browser).
 * Contains: ref parsing, classification, markdown content parsing,
 * edge resolution, graph building from file maps.
 */

const yaml = require('js-yaml');

/**
 * Parse YAML frontmatter from markdown content (browser-safe, no fs).
 * Equivalent to gray-matter but without Node.js dependencies.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, content };
  let data = {};
  try { data = yaml.load(match[1]) || {}; } catch (_e) { /* invalid YAML */ }
  const body = content.slice(match[0].length).replace(/^\r?\n/, '');
  return { data, content: body };
}
const {
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,
  RESOURCE_TYPE_TO_CATEGORY,
  DIR_TO_CATEGORY,
  inferScope,
} = require('./taxonomy');
const { resolveSchemaKey } = require('./schemas/frontmatter-schemas');

// ── Constants ──────────────────────────────────────────────────────────

const WORKSPACE_EXTENSIONS = ['.md', '.json', '.yaml', '.yml'];

const NODE_TYPE_ALIASES = new Set(['step', 'router', 'sub-workflow']);

const ARTIFACT_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'output', '.next',
  '__pycache__', '.venv', 'venv', '.cache', 'coverage',
]);

const REF_PATTERNS = [
  { name: 'conditional_edge', re: /\{\{->\s*([^|}]+?)\s*\|\s*([^}]+?)\s*\}\}/g, type: 'conditional_edge' },
  { name: 'edge',             re: /\{\{->\s*([^}]+?)\s*\}\}/g,                   type: 'edge' },
  { name: 'data_flow',        re: /\{\{<<\s*([^}]+?)\s*\}\}/g,                   type: 'data_flow' },
  { name: 'mention',          re: /\{\{([^}<>|]+?)\}\}/g,                         type: 'mention' },
];

// ── Ref parsing ────────────────────────────────────────────────────────

function lineFromOffset(content, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

function parseRef(token, type, groups) {
  const trimmed = token.trim();
  const ref = { raw: trimmed, semanticType: type, category: null, name: null, condition: null };

  if (type === 'conditional_edge' && groups) {
    const target = (groups[0] || '').trim();
    const cond = (groups[1] || '').trim();
    if (target.includes('/')) {
      const [c, n] = target.split('/', 2);
      ref.category = c; ref.name = n;
    } else {
      ref.category = 'nodes'; ref.name = target;
    }
    ref.condition = cond;
    ref.semanticType = 'edge';
  } else if (type === 'data_flow') {
    ref.category = 'output'; ref.name = trimmed;
  } else {
    if (trimmed.includes('/')) {
      const [c, ...rest] = trimmed.split('/');
      ref.category = c; ref.name = rest.join('/');
    } else {
      ref.name = trimmed;
    }
  }
  return ref;
}

function extractRefs(content) {
  if (!content) return [];
  const refs = [];
  const seen = new Set();
  for (const pattern of REF_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let match;
    while ((match = re.exec(content)) !== null) {
      const key = `${pattern.type}:${match[0]}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const groups = match.slice(1);
      const ref = parseRef(match[1] || match[0], pattern.type, groups);
      ref.offset = match.index;
      ref.line = lineFromOffset(content, match.index);
      ref.raw = match[0].replace(/^\{\{|\}\}$/g, '').trim();
      refs.push(ref);
    }
  }
  refs.sort((a, b) => a.offset - b.offset);
  return refs;
}

// ── Classification ─────────────────────────────────────────────────────

function classifyResource(file, dirPath) {
  const fm = file.frontmatter || {};
  if (fm.type) {
    const key = resolveSchemaKey(fm.type);
    if (key) return fm.type;
  }
  if (!dirPath) return 'untyped';
  const topDir = dirPath.split('/')[0];
  if (DIR_TO_CATEGORY[topDir]) return topDir.replace(/s$/, '');
  return 'untyped';
}

function identifyPrimaryFile(files) {
  if (files.length === 0) throw new Error('identifyPrimaryFile called with empty files array');
  if (files.length === 1) return files[0];
  const explicit = files.find(f => f.frontmatter && f.frontmatter.primary === true);
  if (explicit) return explicit;
  const skill = files.find(f => {
    const name = (f.relativePath || f.filePath || '').split('/').pop();
    return name === 'SKILL.md';
  });
  if (skill) return skill;
  const main = files.find(f => {
    const name = (f.relativePath || f.filePath || '').split('/').pop();
    return name === 'main.md';
  });
  if (main) return main;
  return files.sort((a, b) =>
    (a.relativePath || a.filePath || '').localeCompare(b.relativePath || b.filePath || '')
  )[0];
}

// ── Edge resolution ────────────────────────────────────────────────────

function resolveEdgeTarget(ref, nodeIds) {
  if (ref.category === 'nodes' && nodeIds.has(ref.name)) return ref.name;
  if (nodeIds.has(ref.name)) return ref.name;
  const bySlash = (ref.raw || '').split('/').pop();
  if (bySlash && nodeIds.has(bySlash)) return bySlash;
  return null;
}

// ── Markdown content parsing (no fs) ───────────────────────────────────

function parseMarkdownContent(rawContent, relativePath, mode) {
  mode = mode || 'full';
  let frontmatter = {}, body = rawContent;
  try {
    const p = parseFrontmatter(rawContent);
    frontmatter = p.data || {};
    body = p.content;
  } catch (_e) {
    frontmatter = {};
    body = rawContent;
  }

  const basename = relativePath.split('/').pop() || relativePath;
  let title = basename.replace(/\.md$/, '');
  const h = body.match(/^#\s+(.+)$/m);
  if (h) title = h[1].trim();

  const result = {
    filePath: relativePath,
    relativePath: relativePath.replace(/\\/g, '/'),
    frontmatter, title, content: '', rawContent, refs: [],
    resourceType: null,
  };
  if (mode === 'metadata-only') return result;
  result.content = body;
  result.refs = extractRefs(body);
  return result;
}

// ── parseFromFiles (browser-safe graph builder) ────────────────────────

function parseFromFiles(fileMap, mode) {
  mode = mode || 'full';
  const mdPaths = Object.keys(fileMap).filter(p => p.endsWith('.md')).sort();
  const jsonPaths = Object.keys(fileMap).filter(p => p.endsWith('.json')).sort();

  // 1. Parse all files
  const allFiles = [];
  for (const relPath of mdPaths) {
    const parsed = parseMarkdownContent(fileMap[relPath], relPath, mode);
    const dirPart = relPath.includes('/') ? relPath.split('/').slice(0, -1).join('/') : '';
    parsed.resourceType = classifyResource(parsed, dirPart);
    allFiles.push(parsed);
  }

  // 2. Categorize
  const instructions = {}, capabilities = {}, runbooks = {}, memory = {};
  let descriptorFile;
  const reservedSet = new Set(RESERVED_DIRS);

  for (const file of allFiles) {
    const relDir = file.relativePath.includes('/')
      ? file.relativePath.split('/').slice(0, -1).join('/') : '';
    const isRootLevel = !relDir;

    if (isRootLevel && !descriptorFile &&
      ((file.frontmatter && file.frontmatter.type === 'agents') ||
        file.relativePath.split('/').pop() === 'AGENTS.md')) {
      descriptorFile = file;
    }

    const firstSegment = relDir ? file.relativePath.split('/')[0] : '';
    const categoryFromDir = firstSegment ? DIR_TO_CATEGORY[firstSegment] : null;
    // Also check for workflow-scoped resources: <workflow>/<resource-dir>/<file>
    const parts = file.relativePath.split('/');
    const secondSegment = parts.length >= 3 ? parts[1] : '';
    const categoryFromWfDir = (!categoryFromDir && secondSegment) ? DIR_TO_CATEGORY[secondSegment] : null;
    const categoryFromType = file.resourceType ? RESOURCE_TYPE_TO_CATEGORY[file.resourceType] : null;
    const categoryName = categoryFromType || categoryFromDir || categoryFromWfDir;
    if (!categoryName) continue;

    const key = (file.frontmatter && file.frontmatter.name)
      ? file.frontmatter.name
      : (file.relativePath.split('/').pop() || '').replace(/\.md$/, '');
    const scope = inferScope(file.frontmatter || {}, categoryName);

    if (categoryName === 'instructions') {
      instructions[key] = { ...file, scope };
    } else if (categoryName === 'capabilities') {
      const fm = file.frontmatter || {};
      capabilities[key] = {
        ...file, scope, toolType: fm.type || 'builtin',
        command: fm.command, mcp: fm.mcp, package: fm.package,
        parameters: fm.parameters, builtinMapping: fm.builtin_mapping,
      };
    } else if (categoryName === 'runbooks') {
      runbooks[key] = { ...file, scope };
    } else if (categoryName === 'memory') {
      memory[key] = file;
    }
  }

  // 3. Workflows (by path grouping)
  const workflows = {};
  const topDirs = new Set();
  for (const p of mdPaths) {
    const seg = p.split('/')[0];
    if (p.split('/').length >= 2 && !reservedSet.has(seg) &&
        !ARTIFACT_DIRS.has(seg) && !seg.startsWith('.')) {
      topDirs.add(seg);
    }
  }

  for (const wfId of topDirs) {
    const wfFiles = mdPaths.filter(p => p.startsWith(wfId + '/'));
    const hasDescriptor = wfFiles.some(p =>
      p === wfId + '/AGENTS.md' ||
      (fileMap[p] && /type:\s*agents/.test(
        (fileMap[p].match(/^---\n([\s\S]*?)\n---/) || [])[1] || '')));
    const hasNodeDirs = wfFiles.some(p => p.split('/').length >= 3);
    if (!hasDescriptor && !hasNodeDirs) continue;

    let wfDescriptor;
    const nodes = {};
    const nodeDirSet = new Set();

    for (const p of wfFiles) {
      const rel = p.slice(wfId.length + 1);
      const parts = rel.split('/');
      if (parts.length === 1) {
        const parsed = allFiles.find(f => f.relativePath === p);
        if (parsed && (rel === 'AGENTS.md' ||
          (parsed.frontmatter && parsed.frontmatter.type === 'agents'))) {
          wfDescriptor = parsed;
        }
      } else if (parts.length >= 2) {
        nodeDirSet.add(parts[0]);
      }
    }

    for (const nodeId of nodeDirSet) {
      if (reservedSet.has(nodeId)) continue;
      const nodePrefix = wfId + '/' + nodeId + '/';
      const parsedNodeFiles = wfFiles
        .filter(p => p.startsWith(nodePrefix))
        .map(p => allFiles.find(f => f.relativePath === p))
        .filter(Boolean);
      if (!parsedNodeFiles.length) continue;

      let primaryFile;
      try { primaryFile = identifyPrimaryFile(parsedNodeFiles); }
      catch { primaryFile = parsedNodeFiles[0]; }
      const contextFiles = parsedNodeFiles.filter(f => f !== primaryFile);
      const fm = primaryFile.frontmatter || {};
      const nodeRefs = [];
      for (const f of parsedNodeFiles) nodeRefs.push(...(f.refs || []));

      nodes[nodeId] = {
        id: nodeId,
        name: fm.name || nodeId,
        description: fm.description || '',
        nodeType: fm.type && NODE_TYPE_ALIASES.has(fm.type) ? fm.type : 'step',
        entry: fm.entry === true,
        entryInferred: false,
        primaryFile, contextFiles,
        allRefs: nodeRefs,
        frontmatter: fm,
        contextBudget: fm.context && fm.context.max_tokens
          ? fm.context.max_tokens : undefined,
        outputDeclarations: fm.outputs || undefined,
      };
    }

    // Edges
    const edges = [];
    const nodeIds = new Set(Object.keys(nodes));
    for (const nid of nodeIds) {
      for (const ref of nodes[nid].allRefs) {
        if (ref.semanticType !== 'edge') continue;
        const targetId = resolveEdgeTarget(ref, nodeIds);
        if (targetId) {
          const e = { from: nid, to: targetId, sourceRef: ref };
          if (ref.condition) e.condition = ref.condition;
          edges.push(e);
        }
      }
    }

    // Entry points
    let entryPoints = Object.keys(nodes).filter(id => nodes[id].entry === true);
    if (!entryPoints.length && wfDescriptor) {
      for (const ref of (wfDescriptor.refs || [])) {
        const t = resolveEdgeTarget(ref, nodeIds);
        if (t && !entryPoints.includes(t)) entryPoints.push(t);
      }
    }
    if (!entryPoints.length) {
      const targets = new Set(edges.map(e => e.to));
      const roots = [...nodeIds].filter(id => !targets.has(id));
      if (roots.length === 1) {
        entryPoints = roots;
        nodes[roots[0]].entry = true;
        nodes[roots[0]].entryInferred = true;
      }
    }

    const wfFm = wfDescriptor ? (wfDescriptor.frontmatter || {}) : {};
    workflows[wfId] = {
      id: wfId, dir: wfId,
      name: wfFm.name || wfId,
      description: wfFm.description || '',
      descriptorFile: wfDescriptor || null,
      nodes, edges, entryPoints,
    };
  }

  // 4. Custom files
  const categorizedPaths = new Set();
  for (const k of Object.keys(instructions)) categorizedPaths.add(instructions[k].relativePath);
  for (const k of Object.keys(capabilities)) categorizedPaths.add(capabilities[k].relativePath);
  for (const k of Object.keys(runbooks)) categorizedPaths.add(runbooks[k].relativePath);
  for (const k of Object.keys(memory)) categorizedPaths.add(memory[k].relativePath);
  if (descriptorFile) categorizedPaths.add(descriptorFile.relativePath);
  for (const wf of Object.values(workflows)) {
    if (wf.descriptorFile) categorizedPaths.add(wf.descriptorFile.relativePath);
    for (const node of Object.values(wf.nodes || {})) {
      if (node.primaryFile) categorizedPaths.add(node.primaryFile.relativePath);
      for (const cf of node.contextFiles || []) categorizedPaths.add(cf.relativePath);
    }
  }
  const customFiles = {};
  for (const file of allFiles) {
    if (!categorizedPaths.has(file.relativePath)) {
      const key = file.relativePath.endsWith('.md')
        ? file.relativePath.slice(0, -3) : file.relativePath;
      if (!file.resourceType || file.resourceType === 'untyped') file.resourceType = 'untyped';
      customFiles[key] = file;
    }
  }

  // 5. Hooks (JSON) — root hooks/ and workflow-scoped <workflow>/hooks/
  const hooks = {};
  for (const p of jsonPaths) {
    const segments = p.split('/');
    const isRootHook = segments[0] === 'hooks';
    const isWfHook = segments.length >= 3 && segments[1] === 'hooks';
    if (!isRootHook && !isWfHook) continue;
    try {
      hooks[segments[segments.length - 1].replace(/\.json$/, '')] = JSON.parse(fileMap[p]);
    } catch (_e) { /* skip */ }
  }

  // 6. Identity
  let identity;
  if (descriptorFile && descriptorFile.frontmatter && descriptorFile.frontmatter.identity) {
    identity = descriptorFile.frontmatter.identity;
  }

  return {
    rootDir: '.', descriptorFile, identity,
    instructions, capabilities, runbooks, memory,
    hooks, customFiles, workflows, allFiles,
    mcpServers: {}, mcpErrors: [],
  };
}

// ── Tree builder ───────────────────────────────────────────────────────

function buildTreeFromPaths(paths) {
  const root = { name: '.', path: '.', type: 'directory', children: [] };
  const dirs = { '.': root };
  for (const p of paths.sort()) {
    const parts = p.split('/');
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      if (!dirs[dirPath]) {
        const dir = { name: parts[i], path: dirPath, type: 'directory', children: [] };
        dirs[dirPath] = dir;
        current.children.push(dir);
      }
      current = dirs[dirPath];
    }
    current.children.push({ name: parts[parts.length - 1], path: p, type: 'file' });
  }
  return root;
}

// ── Exports ────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  REF_PATTERNS,
  NODE_TYPE_ALIASES,
  ARTIFACT_DIRS,
  WORKSPACE_EXTENSIONS,
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,

  // Frontmatter
  parseFrontmatter,

  // Ref parsing
  parseRef,
  extractRefs,
  lineFromOffset,

  // Classification
  classifyResource,
  identifyPrimaryFile,

  // Content parsing (no fs)
  parseMarkdownContent,

  // Graph building (no fs)
  parseFromFiles,

  // Edge resolution
  resolveEdgeTarget,

  // Tree builder
  buildTreeFromPaths,

  // Ref resolution (for validator)
  resolveRef: function resolveRef(ref, graph) {
    if (!ref || !graph) return null;
    if (ref.semanticType === 'data_flow') {
      let nodeName = ref.name;
      // Strip output. prefix: "output.gather-requirements" → "gather-requirements"
      if (nodeName.startsWith('output.')) nodeName = nodeName.slice(7);
      for (const wfKey of Object.keys(graph.workflows || {})) {
        const nodes = graph.workflows[wfKey].nodes || {};
        for (const nodeKey of Object.keys(nodes)) {
          const node = nodes[nodeKey];
          if (node.id === nodeName || node.name === nodeName) return { ref, target: node, resolvedBy: 'path' };
        }
      }
      return null;
    }
    const namePart = ref.name || '', categoryPart = ref.category || '';
    let refPath = namePart ? categoryPart + '/' + namePart : categoryPart;
    if (!refPath.endsWith('.md')) refPath += '.md';
    const normalizedRefPath = refPath.replace(/\\/g, '/');
    const allFiles = graph.allFiles || [];
    const pathMatch = allFiles.find(f => (f.relativePath || '').replace(/\\/g, '/') === normalizedRefPath);
    if (pathMatch) return { ref, target: pathMatch, resolvedBy: 'path' };
    const searchName = ref.name || ref.category;
    const nameMatches = allFiles.filter(f => (f.frontmatter || {}).name === searchName);
    if (nameMatches.length === 1) return { ref, target: nameMatches[0], resolvedBy: 'name' };
    if (nameMatches.length > 1) return { ref, target: null, resolvedBy: 'ambiguous', matches: nameMatches };
    return null;
  },
};
