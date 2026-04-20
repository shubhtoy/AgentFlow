/**
 * Tool Scaffolder — converts MCP `tools/list` responses to `.md` capability files.
 *
 * Generates one `.md` file per tool in `.agentflow/capabilities/` with frontmatter
 * containing `type: mcp`, `mcp: <server-name>`, `name`, `description`,
 * `parameters`, `generated: true`, and `generatedAt: <ISO>`.
 *
 * Updates the `discoveredTools` array in mcp.json via config-manager.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { loadMcpConfig, saveMcpConfig } = require('./config-manager');

const AGENTFLOW_DIR = '.agentflow';
const CAPABILITIES_DIR = 'capabilities';

/**
 * Convert a tool name to a file-safe kebab-case name.
 * Replaces underscores and spaces with hyphens, lowercases.
 *
 * @param {string} name — MCP tool name (e.g. "create_issue")
 * @returns {string} kebab-case name (e.g. "create-issue")
 */
function toFileName(name) {
  return name
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * Convert MCP inputSchema (JSON Schema) properties to AgentFlow parameter format.
 *
 * @param {object} inputSchema — JSON Schema from MCP tools/list
 * @returns {object} parameters in AgentFlow frontmatter format
 */
function convertParameters(inputSchema) {
  if (!inputSchema || !inputSchema.properties) {
    return {};
  }

  const params = {};
  const requiredFields = Array.isArray(inputSchema.required) ? inputSchema.required : [];

  for (const [name, schema] of Object.entries(inputSchema.properties)) {
    const param = {};
    if (schema.type) {
      param.type = schema.type;
    }
    if (schema.description) {
      param.description = schema.description;
    }
    param.required = requiredFields.includes(name);
    params[name] = param;
  }

  return params;
}

/**
 * Generate the markdown content for a single MCP tool file.
 *
 * @param {string} serverName — MCP server name
 * @param {object} tool — MCP tool schema from tools/list
 * @param {string} generatedAt — ISO timestamp
 * @returns {string} full markdown file content with frontmatter
 */
function generateToolContent(serverName, tool, generatedAt) {
  const fileName = toFileName(tool.name);
  const description = tool.description || '';
  const parameters = convertParameters(tool.inputSchema);

  const frontmatterData = {
    name: fileName,
    type: 'mcp',
    mcp: serverName,
    description,
    parameters,
    generated: true,
    generatedAt,
  };

  // Use gray-matter to serialize frontmatter
  const body = `\n# ${description || fileName}\n\n${description}\n\n## MCP Server\nServer: \`${serverName}\`\n`;

  return matter.stringify(body, frontmatterData);
}

/**
 * Scaffold MCP tool files from a tools/list response.
 *
 * 1. Creates `.agentflow/capabilities/` directory if needed
 * 2. For each tool, generates the .md file content
 * 3. Skips existing files unless opts.overwrite is true
 * 4. Writes the files
 * 5. Updates the server's `discoveredTools` array in mcp.json
 * 6. Returns array of generated file paths
 *
 * @param {string} rootDir — workspace root directory
 * @param {string} serverName — MCP server name (used in frontmatter `mcp` field)
 * @param {object[]} tools — array of MCP tool schemas from tools/list
 * @param {object} [opts={}] — options
 * @param {boolean} [opts.overwrite] — overwrite existing tool files
 * @returns {string[]} array of generated file paths (relative to rootDir)
 */
function scaffoldTools(rootDir, serverName, tools, opts = {}) {
  const toolsDir = path.join(rootDir, AGENTFLOW_DIR, CAPABILITIES_DIR);

  // Ensure capabilities directory exists
  if (!fs.existsSync(toolsDir)) {
    fs.mkdirSync(toolsDir, { recursive: true });
  }

  const generatedAt = new Date().toISOString();
  const generatedPaths = [];
  const toolNames = [];

  for (const tool of tools) {
    if (!tool || !tool.name) continue;

    const fileName = toFileName(tool.name);
    const filePath = path.join(toolsDir, `${fileName}.md`);
    const relativePath = path.join(AGENTFLOW_DIR, CAPABILITIES_DIR, `${fileName}.md`);

    // Always track tool name for discoveredTools even if file already exists
    toolNames.push(fileName);

    // Skip writing existing files unless overwrite is set
    if (fs.existsSync(filePath) && !opts.overwrite) {
      console.warn(`Skipping existing tool file: ${relativePath}`);
      continue;
    }

    const content = generateToolContent(serverName, tool, generatedAt);
    fs.writeFileSync(filePath, content, 'utf-8');

    generatedPaths.push(relativePath);
  }

  // Update discoveredTools in mcp.json
  const { servers } = loadMcpConfig(rootDir);
  if (servers[serverName]) {
    servers[serverName].discoveredTools = toolNames;
    saveMcpConfig(rootDir, servers);
  }

  return generatedPaths;
}

module.exports = {
  scaffoldTools,
  toFileName,
  convertParameters,
  generateToolContent,
};
