/**
 * Pretty-Printer module for AgentFlow v2.
 *
 * Serializes ParsedFile, NodeDef, and WorkflowGraph objects back to
 * markdown files with optional YAML frontmatter, preserving ref tokens
 * in their original syntax-prefixed form.
 *
 * Requirements: 10.3, 10.4, 10.5, 10.6, 10.7
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { CANONICAL_CATEGORIES } = require('@agentflow/core/taxonomy');

// ---------------------------------------------------------------------------
// serialize(file) → string
// ---------------------------------------------------------------------------

/**
 * Serialize a ParsedFile back to a markdown string.
 *
 * - When frontmatter fields are present, produces a YAML frontmatter block
 *   delimited by `---`.
 * - When the metadata object is empty (no keys), omits the frontmatter block
 *   entirely.
 * - Ref tokens in the content body are already stored in their original
 *   syntax-prefixed form (`{{category/name}}`, `{{-> …}}`, etc.), so no
 *   transformation is needed — the content is emitted as-is.
 *
 * @param {object} file  A ParsedFile-shaped object with `frontmatter`,
 *                       `content`, and optionally `rawContent`.
 * @returns {string}     The serialized markdown string.
 */
function serialize(file) {
  const fm = file.frontmatter || {};
  const body = file.content != null ? file.content : '';

  // If frontmatter has at least one key, produce a fenced YAML block.
  const hasFrontmatter = Object.keys(fm).length > 0;

  if (!hasFrontmatter) {
    return body;
  }

  // Use gray-matter's stringify to produce `---\n<yaml>\n---\n<body>`.
  // gray-matter.stringify(content, data) returns the full document.
  return matter.stringify(body, fm);
}

// ---------------------------------------------------------------------------
// serializeNode(node, targetDir) → void
// ---------------------------------------------------------------------------

/**
 * Serialize a NodeDef (primary + context files) to a target directory.
 *
 * Creates the directory if it doesn't exist, then writes each file using
 * its original filename (derived from filePath).
 *
 * @param {object} node       A NodeDef with `primaryFile` and `contextFiles`.
 * @param {string} targetDir  Absolute path to the directory to write into.
 */
function serializeNode(node, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  // Collect all files: primary first, then context
  const files = [node.primaryFile, ...node.contextFiles];

  for (const file of files) {
    const filename = path.basename(file.filePath);
    const destPath = path.join(targetDir, filename);
    const serialized = serialize(file);
    fs.writeFileSync(destPath, serialized, 'utf-8');
  }

  // Preserve output/ directory structure if artifacts exist
  if (node.artifacts && node.artifacts.length > 0) {
    const outputDir = path.join(targetDir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    // Note: we don't write artifact content here — artifacts are runtime
    // state managed by the executing agent. We just ensure the directory exists.
  }
}

// ---------------------------------------------------------------------------
// serializeGraph(graph, rootDir) → void
// ---------------------------------------------------------------------------

/**
 * Serialize an entire WorkflowGraph back to an `.agentflow/` directory
 * structure.
 *
 * Writes:
 *   1. Resource category files (instructions, capabilities, runbooks, memory, hooks)
 *      into their respective directories.
 *   2. Workflow descriptor files.
 *   3. Each workflow's nodes via serializeNode().
 *
 * @param {object} graph    A WorkflowGraph.
 * @param {string} rootDir  Absolute path to the `.agentflow/` root directory.
 */
function serializeGraph(graph, rootDir) {
  fs.mkdirSync(rootDir, { recursive: true });

  // --- 1. Write resource category files ---
  const categories = CANONICAL_CATEGORIES;

  for (const cat of categories) {
    const resources = graph[cat];
    if (!resources) continue;

    for (const key of Object.keys(resources)) {
      const file = resources[key];
      if (!file || !file.filePath) continue;

      // Determine destination from relativePath or fall back to category dir
      const relPath = file.relativePath || path.join(cat, path.basename(file.filePath));
      const destPath = path.join(rootDir, relPath);

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, serialize(file), 'utf-8');
    }
  }

  // --- 2. Write root-level descriptor file (if present) ---
  if (graph.descriptorFile && graph.descriptorFile.filePath) {
    const relPath = graph.descriptorFile.relativePath
      || path.basename(graph.descriptorFile.filePath);
    const destPath = path.join(rootDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, serialize(graph.descriptorFile), 'utf-8');
  }

  // --- 3. Write workflows ---
  const workflows = graph.workflows || {};

  for (const wfId of Object.keys(workflows)) {
    const wf = workflows[wfId];
    const wfDir = path.join(rootDir, wfId);
    fs.mkdirSync(wfDir, { recursive: true });

    // Write workflow descriptor file (if present)
    if (wf.descriptorFile && wf.descriptorFile.filePath) {
      const descFilename = path.basename(wf.descriptorFile.filePath);
      const destPath = path.join(wfDir, descFilename);
      fs.writeFileSync(destPath, serialize(wf.descriptorFile), 'utf-8');
    }

    // Write each node
    const nodes = wf.nodes || {};
    for (const nodeId of Object.keys(nodes)) {
      const node = nodes[nodeId];
      const nodeDir = path.join(wfDir, nodeId);
      serializeNode(node, nodeDir);

      // Recursively serialize sub-workflows
      if (node.subWorkflow) {
        serializeSubWorkflow(node.subWorkflow, nodeDir);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// serializeSubWorkflow(wf, parentDir) — internal helper
// ---------------------------------------------------------------------------

/**
 * Recursively serialize a sub-workflow's descriptor and nodes into a
 * parent directory (the sub-workflow node's directory).
 *
 * @param {object} wf         A WorkflowDef (sub-workflow).
 * @param {string} parentDir  The directory of the parent sub-workflow node.
 */
function serializeSubWorkflow(wf, parentDir) {
  // Write descriptor
  if (wf.descriptorFile && wf.descriptorFile.filePath) {
    const descFilename = path.basename(wf.descriptorFile.filePath);
    const destPath = path.join(parentDir, descFilename);
    fs.writeFileSync(destPath, serialize(wf.descriptorFile), 'utf-8');
  }

  // Write nodes
  const nodes = wf.nodes || {};
  for (const nodeId of Object.keys(nodes)) {
    const node = nodes[nodeId];
    const nodeDir = path.join(parentDir, nodeId);
    serializeNode(node, nodeDir);

    // Recurse into nested sub-workflows
    if (node.subWorkflow) {
      serializeSubWorkflow(node.subWorkflow, nodeDir);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  serialize,
  serializeNode,
  serializeGraph,
};
