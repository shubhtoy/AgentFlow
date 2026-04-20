/**
 * AgentFlow v2 — Parser Module
 *
 * Syntax-based semantic reference parsing, frontmatter-driven resource
 * classification, and workflow graph construction.
 *
 * Ref syntax encodes semantic intent via prefixes:
 *   {{category/name}}                        → mention
 *   {{-> category/name}}                     → edge
 *   {{-> category/name | templates/cond}}    → conditional edge (semanticType: 'edge')
 *   {{<< output.nodeName}}                   → data_flow
 *
 * Patterns are applied in order: conditional_edge first to prevent
 * the plain edge pattern from partially matching conditional edges.
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, WORKSPACE_EXTENSIONS } = require('@agentflow/core/parser-core');
const { glob } = require('glob');
const { loadMcpConfig } = require('./mcp/config-manager');

const {
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,
  RESOURCE_TYPE_TO_CATEGORY,
  DIR_TO_CATEGORY,
  isReservedDir,
  inferScope,
} = require('@agentflow/core/taxonomy');
const { resolveSchemaKey } = require('@agentflow/core/schemas/frontmatter-schemas');

/** Node-related frontmatter types that map to the 'node' resource type. */
const NODE_TYPE_ALIASES = new Set(['step', 'router', 'sub-workflow']);

/** Directories inside node dirs that hold runtime artifacts, not context. */
const ARTIFACT_DIRS = new Set(['output']);

/**
 * REF_PATTERNS — applied in this order to avoid partial matches.
 * Each entry has a regex `pattern` and a `type` string used internally
 * to distinguish conditional_edge from plain edge during extraction.
 */
const REF_PATTERNS = [
  // Conditional edge: {{-> target | condition}}
  { pattern: /\{\{->\s*([^}|]+?)\s*\|\s*([^}]+?)\s*\}\}/g, type: 'conditional_edge' },
  // Edge: {{-> target}}
  { pattern: /\{\{->\s*([^}|]+?)\s*\}\}/g, type: 'edge' },
  // Data flow: {{<< output.nodeName}}
  { pattern: /\{\{<<\s*output\.([^}]+?)\s*\}\}/g, type: 'data_flow' },
  // Mention: {{category/name}} (no prefix, no template vars)
  { pattern: /\{\{(?!->)(?!<<)(?!\$)([^}]+?)\}\}/g, type: 'mention' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Split a path string like "category/name" into { category, name }.
 * If there's no slash, category is the whole string and name is empty.
 */
function splitPath(pathStr) {
  const trimmed = pathStr.trim();
  const slashIdx = trimmed.indexOf('/');
  if (slashIdx === -1) {
    return { category: trimmed, name: '' };
  }
  return {
    category: trimmed.substring(0, slashIdx),
    name: trimmed.substring(slashIdx + 1),
  };
}

/**
 * Compute the 1-based line number for a given character offset in content.
 */
function lineFromOffset(content, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

/* ------------------------------------------------------------------ */
/*  Ref Parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a matched ref token into a Ref object.
 *
 * @param {string}   token  - The full matched string including {{ }}
 * @param {string}   type   - One of 'conditional_edge', 'edge', 'data_flow', 'mention'
 * @param {string[]} groups - Captured regex groups (without the full match)
 * @returns {object} Partial Ref (offset and line are added by extractRefs)
 */
function parseRef(token, type, groups) {
  // Strip the outer {{ }} to get the raw inner content
  const raw = token.slice(2, -2).trim();

  if (type === 'conditional_edge') {
    // groups[0] = target path, groups[1] = condition path
    const { category, name } = splitPath(groups[0]);
    return {
      raw,
      semanticType: 'edge',
      category,
      name,
      condition: groups[1].trim(),
    };
  }

  if (type === 'edge') {
    // groups[0] = target path
    const { category, name } = splitPath(groups[0]);
    return {
      raw,
      semanticType: 'edge',
      category,
      name,
    };
  }

  if (type === 'data_flow') {
    // groups[0] = node name (after output.)
    return {
      raw,
      semanticType: 'data_flow',
      category: 'output',
      name: groups[0].trim(),
    };
  }

  // mention — groups[0] = full path
  const { category, name } = splitPath(groups[0]);
  return {
    raw,
    semanticType: 'mention',
    category,
    name,
  };
}

/**
 * Extract all refs from markdown content.
 *
 * Applies REF_PATTERNS in order (conditional_edge first to avoid partial
 * match by the plain edge pattern). Tracks matched character ranges to
 * prevent double-matching overlapping patterns.
 *
 * @param {string} content - Markdown content to scan
 * @returns {object[]} Array of Ref objects sorted by offset
 */
function extractRefs(content) {
  if (!content) return [];

  const refs = [];
  // Track matched ranges as [start, end) pairs to avoid double-matching
  const matched = [];

  for (const { pattern, type } of REF_PATTERNS) {
    // Reset the regex lastIndex for each pass
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Skip if this range overlaps with an already-matched range
      const overlaps = matched.some(
        ([mStart, mEnd]) => start < mEnd && end > mStart
      );
      if (overlaps) continue;

      matched.push([start, end]);

      // Build groups array (captured groups only, not the full match)
      const groups = [];
      for (let i = 1; i < match.length; i++) {
        groups.push(match[i]);
      }

      const ref = parseRef(match[0], type, groups);
      ref.offset = start;
      ref.line = lineFromOffset(content, start);

      refs.push(ref);
    }
  }

  // Sort by offset so refs appear in document order
  refs.sort((a, b) => a.offset - b.offset);
  return refs;
}

/* ------------------------------------------------------------------ */
/*  Placeholder functions (implemented in later tasks)                 */
/* ------------------------------------------------------------------ */

/** Parse a single markdown file: frontmatter + content + refs. */
/**
 * Parse a single markdown file: frontmatter + content + refs.
 *
 * @param {string} filePath - Absolute path to the .md file
 * @param {string} [mode='full'] - 'full' or 'metadata-only'
 * @returns {object|null} ParsedFile object or null if file doesn't exist
 */
function parseMarkdownFile(filePath, mode = 'full') {
  // Handle file not found
  let rawContent;
  try {
    rawContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

  // Parse frontmatter, handling invalid YAML
  let frontmatter = {};
  let body = rawContent;
  try {
    const parsed = parseFrontmatter(rawContent);
    frontmatter = parsed.data || {};
    body = parsed.content;
  } catch (err) {
    // Invalid YAML frontmatter — treat as no frontmatter
    console.warn(`Warning: invalid YAML frontmatter in ${filePath}: ${err.message}`);
    frontmatter = {};
    body = rawContent;
  }

  // Extract title: first # heading in body, fallback to filename without extension
  let title = path.basename(filePath, path.extname(filePath));
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    title = headingMatch[1].trim();
  }

  // Build the ParsedFile object
  const result = {
    filePath,
    relativePath: '',       // Set later by caller
    frontmatter,
    title,
    content: '',
    rawContent,
    refs: [],
    resourceType: null,     // Set later by classifyResource
  };

  if (mode === 'metadata-only') {
    // metadata-only: skip body content and refs
    return result;
  }

  // full mode: include content and extract refs
  result.content = body;
  result.refs = extractRefs(body);

  return result;
}

/**
 * Parse markdown content directly (no filesystem access).
 * Browser-compatible alternative to parseMarkdownFile.
 *
 * @param {string} rawContent - Raw markdown string
 * @param {string} relativePath - Relative path (e.g. 'instructions/foo.md')
 * @param {string} [mode='full'] - 'full' or 'metadata-only'
 * @returns {object} ParsedFile object
 */
function parseMarkdownContent(rawContent, relativePath, mode = 'full') {
  let frontmatter = {};
  let body = rawContent;
  try {
    const parsed = parseFrontmatter(rawContent);
    frontmatter = parsed.data || {};
    body = parsed.content;
  } catch (_err) {
    frontmatter = {};
    body = rawContent;
  }

  const basename = relativePath.split('/').pop() || relativePath;
  let title = basename.replace(/\.md$/, '');
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) title = headingMatch[1].trim();

  const result = {
    filePath: relativePath,
    relativePath: relativePath.replace(/\\/g, '/'),
    frontmatter,
    title,
    content: '',
    rawContent,
    refs: [],
    resourceType: null,
  };

  if (mode === 'metadata-only') return result;
  result.content = body;
  result.refs = extractRefs(body);
  return result;
}

/**
 * Classify a parsed file's resource type.
 * Priority: frontmatter.type > directory inference > null (untyped)
 *
 * @param {object} file - ParsedFile object
 * @param {string} dirPath - The directory path relative to .agentflow/ root
 * @returns {string|null} ResourceType or null
 */
function classifyResource(file, dirPath) {
  // 1. Frontmatter type takes priority
  const fmType = file.frontmatter && file.frontmatter.type;
  if (fmType) {
    if (NODE_TYPE_ALIASES.has(fmType)) return 'node';
    // Normalize legacy names: tool→capability, skill→instruction, etc.
    return resolveSchemaKey(fmType);
  }

  // 2. Infer from directory — check the first segment of dirPath
  if (dirPath) {
    const firstSegment = dirPath.split('/')[0];
    if (isReservedDir(firstSegment)) {
      return RESOURCE_TYPE_MAP[firstSegment] || 'untyped';
    }
  }

  // 3. Untyped — still a valid resource, just not in a reserved directory
  return 'untyped';
}

/**
 * Identify the primary file in a node directory.
 * Priority: primary:true frontmatter > main.md > alphabetical first
 *
 * @param {object[]} files - Array of ParsedFile objects
 * @returns {object} The primary ParsedFile
 */
function identifyPrimaryFile(files) {
  if (files.length === 0) {
    throw new Error('identifyPrimaryFile called with empty files array');
  }

  // Single file — it's the primary
  if (files.length === 1) {
    return files[0];
  }

  // 1. Check for primary:true in frontmatter
  const primaryMarked = files.find(
    (f) => f.frontmatter && f.frontmatter.primary === true
  );
  if (primaryMarked) return primaryMarked;

  // 2. Look for main.md by filename
  const mainFile = files.find(
    (f) => path.basename(f.filePath) === 'main.md'
  );
  if (mainFile) return mainFile;

  // 3. Alphabetical first by filename
  const sorted = [...files].sort((a, b) =>
    path.basename(a.filePath).localeCompare(path.basename(b.filePath))
  );
  return sorted[0];
}

/** Parse a node directory. */
/**
 * Parse a node directory: read all .md files, identify primary file,
 * classify context files, determine node type, collect all refs.
 *
 * @param {string} dirPath - Absolute path to the node directory
 * @param {string} workflowRoot - Absolute path to the workflow root directory
 * @returns {object} NodeDef
 */
function parseNode(dirPath, workflowRoot) {
  // Read all entries in the directory
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  // Separate files from subdirectories
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort(); // sort for deterministic ordering

  if (mdFiles.length === 0) {
    throw new Error(`No .md files found in node directory: ${dirPath}`);
  }

  // Scan for output/ artifact directory
  const hasOutputDir = entries.some(
    (e) => e.isDirectory() && ARTIFACT_DIRS.has(e.name)
  );
  let artifacts = [];
  if (hasOutputDir) {
    const outputDir = path.join(dirPath, 'output');
    try {
      const outputEntries = fs.readdirSync(outputDir);
      artifacts = outputEntries
        .filter((f) => WORKSPACE_EXTENSIONS.some(ext => f.endsWith(ext)) || f.endsWith('.txt'))
        .map((f) => ({
          name: path.basename(f, path.extname(f)),
          filename: f,
          relativePath: path.relative(workflowRoot, path.join(outputDir, f)).replace(/\\/g, '/'),
        }));
    } catch (e) {
      // skip unreadable output dir
    }
  }

  // Parse each .md file (NOT from output/ — those are artifacts, not context)
  const parsedFiles = [];
  const relativeDir = path.relative(workflowRoot, dirPath);

  for (const filename of mdFiles) {
    const filePath = path.join(dirPath, filename);
    const parsed = parseMarkdownFile(filePath, 'full');
    if (!parsed) continue;

    // Set relativePath relative to workflowRoot
    parsed.relativePath = path.relative(workflowRoot, filePath);

    // Classify the resource type using the relative dir
    parsed.resourceType = classifyResource(parsed, relativeDir);

    parsedFiles.push(parsed);
  }

  if (parsedFiles.length === 0) {
    throw new Error(`No parseable .md files in node directory: ${dirPath}`);
  }

  // Identify primary file
  const primaryFile = identifyPrimaryFile(parsedFiles);

  // Context files = all non-primary files
  const contextFiles = parsedFiles.filter((f) => f !== primaryFile);

  // Determine node type from primary file's frontmatter
  const fm = primaryFile.frontmatter || {};
  const VALID_NODE_TYPES = ['step', 'router', 'sub-workflow'];
  const nodeType = VALID_NODE_TYPES.includes(fm.type) ? fm.type : 'step';

  // Entry flag from frontmatter
  const entry = fm.entry === true;

  // Name: frontmatter name → primary file title
  const name = fm.name || primaryFile.title;

  // Description from frontmatter
  const description = fm.description || undefined;

  // --- Context budget (MWP-inspired Layer 2 scoping) ---
  // Extract context declaration from frontmatter if present
  const contextBudget = fm.context || undefined;

  // --- Output declarations (MWP-inspired Layer 4 artifacts) ---
  // Extract output declarations from frontmatter if present
  const outputDeclarations = fm.outputs || undefined;

  // Collect all refs from all files (primary + context)
  const allRefs = [];
  for (const f of parsedFiles) {
    allRefs.push(...f.refs);
  }

  // Node id is the directory path relative to workflow root
  const id = relativeDir || path.basename(dirPath);

  return {
    id,
    name,
    description,
    nodeType,
    entry,
    entryInferred: false,
    primaryFile,
    contextFiles,
    allRefs,
    frontmatter: fm,
    // MWP-inspired fields
    contextBudget,
    outputDeclarations,
    artifacts,
  };
}


/** Recursively parse a workflow directory. */
/**
 * Recursively parse a workflow directory.
 * Finds node dirs, builds edges from Edge_Refs, handles sub-workflows.
 *
 * @param {string} workflowDir - Absolute path to the workflow directory
 * @param {string} [mode='full'] - 'full' or 'metadata-only'
 * @returns {object} WorkflowDef
 */
function parseWorkflow(workflowDir, mode = 'full') {
  const entries = fs.readdirSync(workflowDir, { withFileTypes: true });

  // --- 1. Find the descriptor file (type: agents frontmatter or AGENTS.md) ---
  let descriptorFile = null;
  const topMdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();

  for (const filename of topMdFiles) {
    const filePath = path.join(workflowDir, filename);
    const parsed = parseMarkdownFile(filePath, mode);
    if (!parsed) continue;
    parsed.relativePath = path.relative(workflowDir, filePath);
    parsed.resourceType = classifyResource(parsed, '');

    if (
      (parsed.frontmatter && parsed.frontmatter.type === 'agents') ||
      filename === 'AGENTS.md'
    ) {
      descriptorFile = parsed;
      break;
    }
  }

  // --- 2. Identify node directories ---
  // A node directory is a subdirectory that contains at least one .md file
  // and is NOT a reserved directory.
  const reservedSet = new Set(RESERVED_DIRS);
  const nodeDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (reservedSet.has(entry.name)) continue;
    // Skip artifact directories (output/) at the workflow level
    if (ARTIFACT_DIRS.has(entry.name)) continue;

    const subDirPath = path.join(workflowDir, entry.name);
    let hasMd = false;
    try {
      const subEntries = fs.readdirSync(subDirPath);
      hasMd = subEntries.some((e) => e.endsWith('.md'));
    } catch (err) {
      // Skip unreadable directories
      continue;
    }
    if (hasMd) {
      nodeDirs.push(entry.name);
    }
  }

  nodeDirs.sort();

  // --- 3. Parse each node directory ---
  const nodes = {};

  for (const dirName of nodeDirs) {
    const dirPath = path.join(workflowDir, dirName);
    const node = parseNode(dirPath, workflowDir);
    nodes[node.id] = node;

    // --- 4. Recursively parse sub-workflow nodes ---
    if (node.nodeType === 'sub-workflow') {
      node.subWorkflow = parseWorkflow(dirPath, mode);
    }
  }

  // --- 5. Build edges from edge and conditional_edge refs ---
  const edges = [];
  const nodeIds = new Set(Object.keys(nodes));

  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    for (const ref of node.allRefs) {
      if (ref.semanticType !== 'edge') continue;

      // Resolve the ref target to a node id within this workflow.
      // Try matching ref category/name against node ids.
      const targetId = resolveEdgeTarget(ref, nodeIds);
      if (targetId) {
        const edgeDef = {
          from: nodeId,
          to: targetId,
          sourceRef: ref,
        };
        if (ref.condition) {
          edgeDef.condition = ref.condition;
        }
        edges.push(edgeDef);
      }
    }
  }

  // --- 6. Entry point detection ---
  // Step A: Nodes with explicit entry: true in frontmatter
  let entryPoints = Object.keys(nodes).filter((id) => nodes[id].entry === true);

  // Step B: If none, check descriptor file for entry hints
  if (entryPoints.length === 0 && descriptorFile) {
    // Look for refs in the descriptor that point to nodes
    const descriptorRefs = descriptorFile.refs || [];
    for (const ref of descriptorRefs) {
      const targetId = resolveEdgeTarget(ref, nodeIds);
      if (targetId && !entryPoints.includes(targetId)) {
        entryPoints.push(targetId);
      }
    }
  }

  // Step C: If still none, infer from nodes with no incoming edges
  if (entryPoints.length === 0) {
    const nodesWithIncoming = new Set(edges.map((e) => e.to));
    for (const nodeId of nodeIds) {
      if (!nodesWithIncoming.has(nodeId)) {
        entryPoints.push(nodeId);
        nodes[nodeId].entryInferred = true;
      }
    }
  }

  // --- 7. Build WorkflowDef ---
  const id = path.basename(workflowDir);
  const name = (descriptorFile && descriptorFile.frontmatter && descriptorFile.frontmatter.name)
    || (descriptorFile && descriptorFile.title)
    || id;
  const description = (descriptorFile && descriptorFile.frontmatter && descriptorFile.frontmatter.description)
    || undefined;

  return {
    id,
    name,
    description,
    dir: workflowDir,
    descriptorFile: descriptorFile || undefined,
    nodes,
    edges,
    entryPoints,
  };
}

/**
 * Resolve an edge ref's target to a node id within the workflow.
 *
 * Tries to match the ref's category/name path against node ids.
 * If the ref has just a name (no category), tries matching against node names.
 *
 * @param {object} ref - A Ref object
 * @param {Set<string>} nodeIds - Set of node ids in this workflow
 * @returns {string|null} Matched node id or null
 */
function resolveEdgeTarget(ref, nodeIds) {
  // Build the full ref path: category/name
  const refCategory = ref.category || '';
  const refName = ref.name || '';
  let fullPath;
  if (refName) {
    fullPath = refCategory + '/' + refName;
  } else {
    fullPath = refCategory;
  }

  // Try exact match against node ids
  if (nodeIds.has(fullPath)) {
    return fullPath;
  }

  // Try matching just the name portion against node ids
  // (e.g., ref is "nodes/fix" and node id is "fix")
  if (refName && nodeIds.has(refName)) {
    return refName;
  }

  // Try matching the category as a node id (for refs like {{-> fix}})
  if (!refName && nodeIds.has(refCategory)) {
    return refCategory;
  }

  return null;
}


/**
 * Resolve a ref token to a target resource.
 * Resolution order: exact path match → frontmatter name match.
 * Returns null if unresolved, ambiguous result if multiple name matches.
 *
 * For data_flow refs (semanticType === 'data_flow'), resolution looks for
 * a node whose id or name matches the ref's name field (the part after output.).
 *
 * @param {object} ref   - A Ref object with raw, semanticType, category, name, condition
 * @param {object} graph - A WorkflowGraph with allFiles, workflows, etc.
 * @returns {{ ref, target, resolvedBy, matches? } | null}
 */
function resolveRef(ref, graph) {
  if (!ref || !graph) return null;

  // --- Data flow refs: resolve to a node in the workflows ---
  if (ref.semanticType === 'data_flow') {
    const nodeName = ref.name;
    // Search all workflows for a node matching by id or name
    const workflows = graph.workflows || {};
    for (const wfKey of Object.keys(workflows)) {
      const wf = workflows[wfKey];
      const nodes = wf.nodes || {};
      for (const nodeKey of Object.keys(nodes)) {
        const node = nodes[nodeKey];
        if (node.id === nodeName || node.name === nodeName) {
          return { ref, target: node, resolvedBy: 'path' };
        }
      }
    }
    return null;
  }

  // --- Path-based resolution (step 1) ---
  // Build the expected relative path: category/name, appending .md if needed
  const namePart = ref.name || '';
  const categoryPart = ref.category || '';
  let refPath;
  if (namePart) {
    refPath = categoryPart + '/' + namePart;
  } else {
    refPath = categoryPart;
  }
  // Append .md if the path doesn't already end with .md
  if (!refPath.endsWith('.md')) {
    refPath = refPath + '.md';
  }

  const allFiles = graph.allFiles || [];

  // Normalize path separators for comparison
  const normalizedRefPath = refPath.replace(/\\/g, '/');

  // Search for exact path match
  const pathMatch = allFiles.find((f) => {
    const rel = (f.relativePath || '').replace(/\\/g, '/');
    return rel === normalizedRefPath;
  });

  if (pathMatch) {
    return { ref, target: pathMatch, resolvedBy: 'path' };
  }

  // --- Name-based resolution (step 2) ---
  // Search all parsed files for frontmatter name match
  const searchName = ref.name || ref.category; // fallback to category if no name
  const nameMatches = allFiles.filter((f) => {
    const fm = f.frontmatter || {};
    return fm.name === searchName;
  });

  if (nameMatches.length === 1) {
    return { ref, target: nameMatches[0], resolvedBy: 'name' };
  }

  if (nameMatches.length > 1) {
    return { ref, target: null, resolvedBy: 'ambiguous', matches: nameMatches };
  }

  // --- No match at all ---
  return null;
}

/** Top-level parser: scans .agentflow/ root. */
/**
 * Top-level parser: scans .agentflow/ root, parses all resources and workflows.
 *
 * 1. Globs all .md files under rootDir
 * 2. Parses each file, classifies resources, groups into categories
 * 3. Identifies workflow directories (non-reserved dirs with node subdirs)
 * 4. Builds WorkflowGraph with instructions, capabilities, runbooks, memory, hooks, workflows, allFiles
 * 5. Records ${env:VARIABLE_NAME} tokens without resolving
 *
 * @param {string} rootDir - Absolute path to the .agentflow/ directory
 * @param {string} [mode='full'] - 'full' or 'metadata-only'
 * @returns {object} WorkflowGraph
 */
function parseRoot(rootDir, mode = 'full') {
  // --- 1. Glob all .md files recursively under rootDir ---
  const mdPaths = glob.sync('**/*.md', { cwd: rootDir, nodir: true });
  mdPaths.sort();

  // --- 2. Parse each file and classify ---
  const allFiles = [];
  for (const relPath of mdPaths) {
    const absPath = path.join(rootDir, relPath);
    const parsed = parseMarkdownFile(absPath, mode);
    if (!parsed) continue;

    // Set relativePath relative to rootDir
    parsed.relativePath = relPath.replace(/\\/g, '/');

    // Classify using the directory portion of the relative path
    const dirPart = path.dirname(relPath).replace(/\\/g, '/');
    const classifyDir = dirPart === '.' ? '' : dirPart;
    parsed.resourceType = classifyResource(parsed, classifyDir);

    allFiles.push(parsed);
  }

  // --- 3. Group files into canonical categories using taxonomy ---
  const instructions = {};
  const capabilities = {};
  const runbooks = {};
  const memory = {};
  let descriptorFile;

  const reservedSet = new Set(RESERVED_DIRS);

  for (const file of allFiles) {
    // Check for root-level descriptor (type: agents or AGENTS.md at root)
    const relDir = path.dirname(file.relativePath);
    const isRootLevel = relDir === '.' || relDir === '';

    if (
      isRootLevel &&
      !descriptorFile &&
      (
        (file.frontmatter && file.frontmatter.type === 'agents') ||
        path.basename(file.filePath) === 'AGENTS.md'
      )
    ) {
      descriptorFile = file;
    }

    // Determine which canonical category this file belongs to
    // Frontmatter type is the source of truth; directory is the fallback
    const firstSegment = relDir === '.' || relDir === '' ? '' : file.relativePath.split('/')[0];
    const categoryFromDir = firstSegment ? DIR_TO_CATEGORY[firstSegment] : null;
    const categoryFromType = file.resourceType ? RESOURCE_TYPE_TO_CATEGORY[file.resourceType] : null;
    const categoryName = categoryFromType || categoryFromDir;

    if (!categoryName) continue; // Not a known resource type — handled later as customFiles or workflow

    // Use frontmatter name as key, fallback to filename without extension
    const key = file.frontmatter && file.frontmatter.name
      ? file.frontmatter.name
      : path.basename(file.filePath, '.md');

    // Infer scope for categories that support it
    const scope = inferScope(file.frontmatter || {}, categoryName);

    if (categoryName === 'instructions') {
      instructions[key] = { ...file, scope };
    } else if (categoryName === 'capabilities') {
      const fm = file.frontmatter || {};
      capabilities[key] = {
        ...file,
        scope,
        toolType: fm.type || 'builtin',
        command: fm.command,
        mcp: fm.mcp,
        package: fm.package,
        parameters: fm.parameters,
        builtinMapping: fm.builtin_mapping,
      };
    } else if (categoryName === 'runbooks') {
      runbooks[key] = { ...file, scope };
    } else if (categoryName === 'memory') {
      memory[key] = file;
    }
    // hooks category files (markdown) are handled here but hooks JSON loading is separate
  }

  // --- 4. Identify workflow directories ---
  // Workflow directories are top-level non-reserved directories that contain
  // subdirectories with .md files (i.e., node directories).
  const workflows = {};
  let topEntries;
  try {
    topEntries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (err) {
    topEntries = [];
  }

  for (const entry of topEntries) {
    if (!entry.isDirectory()) continue;
    if (reservedSet.has(entry.name)) continue;
    if (ARTIFACT_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const dirPath = path.join(rootDir, entry.name);

    // A directory is a workflow only if it has a descriptor (AGENTS.md or type: agents)
    // OR has subdirectories with .md files (node dirs)
    let hasDescriptor = false;
    let hasNodeDirs = false;
    try {
      const subEntries = fs.readdirSync(dirPath, { withFileTypes: true });

      // Check for descriptor file first
      for (const sub of subEntries) {
        if (!sub.isFile() || !sub.name.endsWith('.md')) continue;
        if (sub.name === 'AGENTS.md') { hasDescriptor = true; break; }
        try {
          const content = fs.readFileSync(path.join(dirPath, sub.name), 'utf8');
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch && /type:\s*agents/.test(fmMatch[1])) { hasDescriptor = true; break; }
        } catch {}
      }

      // Check for node subdirs
      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue;
        if (reservedSet.has(sub.name)) continue;
        try {
          const subFiles = fs.readdirSync(path.join(dirPath, sub.name));
          if (subFiles.some((f) => f.endsWith('.md'))) { hasNodeDirs = true; break; }
        } catch {}
      }
    } catch (e) {
      continue;
    }

    // Must have a descriptor OR node dirs to be a workflow
    // But if it has node dirs without a descriptor, only treat as workflow
    // if it's not just a random directory with markdown files
    if (hasDescriptor || hasNodeDirs) {
      const wf = parseWorkflow(dirPath, mode);
      workflows[wf.id] = wf;
    }
  }

  // --- 5. Collect untyped / custom files ---
  // Files that have no recognized resource type and are not part of a workflow
  // node, descriptor, or reserved directory are collected as "customFiles".
  const categorizedPaths = new Set();
  for (const key of Object.keys(instructions)) categorizedPaths.add(instructions[key].relativePath);
  for (const key of Object.keys(capabilities)) categorizedPaths.add(capabilities[key].relativePath);
  for (const key of Object.keys(runbooks)) categorizedPaths.add(runbooks[key].relativePath);
  for (const key of Object.keys(memory)) categorizedPaths.add(memory[key].relativePath);
  if (descriptorFile) categorizedPaths.add(descriptorFile.relativePath);
  for (const wfKey of Object.keys(workflows)) {
    const wf = workflows[wfKey];
    // Compute the workflow's relative path prefix from rootDir
    const wfRelDir = path.relative(rootDir, wf.dir).replace(/\\/g, '/');
    if (wf.descriptorFile) {
      const descRelPath = wf.descriptorFile.relativePath.replace(/\\/g, '/');
      const rootRelPath = wfRelDir ? wfRelDir + '/' + descRelPath : descRelPath;
      categorizedPaths.add(rootRelPath);
    }
    for (const nodeKey of Object.keys(wf.nodes || {})) {
      const node = wf.nodes[nodeKey];
      if (node.primaryFile) {
        // node.primaryFile.relativePath is relative to the workflow dir,
        // so we need to prepend the workflow's relative path to match allFiles entries
        const nodeRelPath = node.primaryFile.relativePath.replace(/\\/g, '/');
        const rootRelPath = wfRelDir ? wfRelDir + '/' + nodeRelPath : nodeRelPath;
        categorizedPaths.add(rootRelPath);
      }
      for (const cf of node.contextFiles || []) {
        const cfRelPath = cf.relativePath.replace(/\\/g, '/');
        const rootRelPath = wfRelDir ? wfRelDir + '/' + cfRelPath : cfRelPath;
        categorizedPaths.add(rootRelPath);
      }
    }
  }

  const customFiles = {};
  for (const file of allFiles) {
    if (!categorizedPaths.has(file.relativePath)) {
      // Use relativePath (without .md) as key for custom files
      const key = file.relativePath.endsWith('.md')
        ? file.relativePath.slice(0, -3)
        : file.relativePath;
      // Ensure untyped files have a consistent resourceType
      if (!file.resourceType || file.resourceType === 'untyped') {
        file.resourceType = 'untyped';
      }
      customFiles[key] = file;
    }
  }

  // --- 6. Extract workspace identity (MWP Layer 0) ---
  // Identity comes from the root descriptor's `identity` frontmatter field
  let identity = undefined;
  if (descriptorFile && descriptorFile.frontmatter && descriptorFile.frontmatter.identity) {
    identity = descriptorFile.frontmatter.identity;
  }

  // --- 7. Load MCP server configuration ---
  const mcpConfig = loadMcpConfig(rootDir);

  // --- 7b. Load hooks JSON files from hooks/ directory ---
  const hooks = {};
  const hooksDir = path.join(rootDir, 'hooks');
  try {
    const hooksEntries = fs.readdirSync(hooksDir, { withFileTypes: true });
    for (const entry of hooksEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const hookPath = path.join(hooksDir, entry.name);
      try {
        const raw = fs.readFileSync(hookPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const stem = path.basename(entry.name, '.json');
        hooks[stem] = parsed;
      } catch (err) {
        console.warn(`Skipping invalid hook file ${entry.name}: ${err.message}`);
      }
    }
  } catch (_err) {
    // hooks/ directory doesn't exist — that's fine
  }

  // --- 8. Build and return WorkflowGraph ---
  return {
    rootDir,
    descriptorFile,
    identity,
    instructions,
    capabilities,
    runbooks,
    memory,
    hooks,
    customFiles,
    workflows,
    allFiles,
    mcpServers: mcpConfig.servers,
    mcpErrors: mcpConfig.errors,
  };
}



/**
 * Parse a workspace from an in-memory file map. No filesystem access.
 * Browser-compatible alternative to parseRoot.
 *
 * @param {Record<string, string>} fileMap - { 'relative/path.md': 'content', ... }
 * @param {string} [mode='full'] - 'full' or 'metadata-only'
 * @returns {object} WorkflowGraph (same shape as parseRoot)
 */
function parseFromFiles(fileMap, mode = 'full') {
  const parserCore = require('@agentflow/core/parser-core');
  return parserCore.parseFromFiles(fileMap, mode);
}

/** Convert a WorkflowGraph to a plain graph structure. */
function toGraph(/* workflowGraph */) {
  throw new Error('toGraph not yet implemented');
}

/** Convert a WorkflowGraph to JSON. */
function toJSON(/* workflowGraph */) {
  throw new Error('toJSON not yet implemented');
}

/** Validate a WorkflowGraph. */
function validate(/* graph, options */) {
  throw new Error('validate not yet implemented');
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  // Constants (re-exported from taxonomy)
  REF_PATTERNS,
  RESERVED_DIRS,
  RESOURCE_TYPE_MAP,
  NODE_TYPE_ALIASES,
  ARTIFACT_DIRS,

  // Ref parsing (task 2.1)
  parseRef,
  extractRefs,

  // File parsing (task 2.3)
  parseMarkdownFile,
  parseMarkdownContent,

  // Classification (task 2.4)
  classifyResource,
  identifyPrimaryFile,

  // Node / workflow parsing (tasks 2.6, 2.9, 2.10)
  parseNode,
  parseWorkflow,
  parseRoot,
  parseFromFiles,

  // Resolution (task 2.7)
  resolveRef,

  // Utilities (later tasks)
  toGraph,
  toJSON,
  validate,
};
