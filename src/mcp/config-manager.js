/**
 * MCP Config Manager — manages `.agentflow/mcp.json`
 *
 * Handles loading and saving the MCP server configuration file.
 * The file uses the standard `mcpServers` top-level key compatible
 * with Claude Desktop, Cursor, VS Code, Kiro, and other MCP clients.
 *
 * IMPORTANT: ${env:VAR} tokens are preserved as literal strings
 * during load/save — they are never resolved here.
 */

const fs = require('fs');
const path = require('path');

const MCP_CONFIG_FILENAME = 'mcp.json';
const AGENTFLOW_DIR = '.agentflow';

/**
 * Resolves the path to `.agentflow/mcp.json` for a given root directory.
 *
 * @param {string} rootDir — workspace root directory
 * @returns {string} absolute path to mcp.json
 */
function mcpConfigPath(rootDir) {
  return path.join(rootDir, AGENTFLOW_DIR, MCP_CONFIG_FILENAME);
}

/**
 * Loads `.agentflow/mcp.json` and returns the parsed server entries.
 *
 * - Returns `{ servers: {}, errors: [] }` when the file does not exist.
 * - Returns parse errors in `errors` array for malformed JSON.
 * - Preserves `${env:VAR}` tokens as literal strings (never resolves them).
 *
 * @param {string} rootDir — workspace root directory
 * @returns {{ servers: object, errors: string[] }}
 */
function loadMcpConfig(rootDir) {
  const configPath = mcpConfigPath(rootDir);

  if (!fs.existsSync(configPath)) {
    return { servers: {}, errors: [] };
  }

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch (err) {
    return { servers: {}, errors: [`Failed to read ${configPath}: ${err.message}`] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { servers: {}, errors: [`Failed to parse mcp.json: ${err.message}`] };
  }

  const servers = (parsed && typeof parsed === 'object' && parsed.mcpServers)
    ? parsed.mcpServers
    : {};

  return { servers, errors: [] };
}

/**
 * Saves MCP server entries to `.agentflow/mcp.json`.
 *
 * Wraps the servers object under the standard `mcpServers` top-level key.
 * Creates the `.agentflow/` directory if it does not exist.
 * Preserves `${env:VAR}` tokens as literal strings (never resolves them).
 *
 * @param {string} rootDir — workspace root directory
 * @param {object} servers — the mcpServers object to save
 */
function saveMcpConfig(rootDir, servers) {
  const configPath = mcpConfigPath(rootDir);
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = { mcpServers: servers };
  fs.writeFileSync(configPath, JSON.stringify(content, null, 2), 'utf-8');
}

/**
 * Converts a registry entry into a standard MCP server config entry
 * and adds it to `.agentflow/mcp.json`.
 *
 * - npm stdio packages → `command: "npx"`, `args: ["-y", identifier]`
 * - pypi stdio packages → `command: "uvx"`, `args: [identifier]`
 * - HTTP/SSE remotes → `url: remote.url`
 * - Stores AgentFlow extension fields alongside standard fields
 *
 * @param {string} rootDir — workspace root directory
 * @param {string} name — server name (key in mcpServers)
 * @param {object} registryEntry — registry API response entry (has `.server`)
 * @param {object} [opts={}] — options
 * @param {boolean} [opts.required] — mark server as required
 * @param {object} [opts.env] — environment variables (KEY=VALUE pairs)
 * @returns {object} the created server entry
 */
function addServer(rootDir, name, registryEntry, opts = {}) {
  const { servers } = loadMcpConfig(rootDir);
  const server = registryEntry.server || registryEntry;

  const entry = {};

  // Convert transport: prefer packages (stdio) first, then remotes (HTTP/SSE)
  // Some registry entries have transport.type, others just have registryType
  const pkg = (server.packages || []).find(p =>
    (p.transport && p.transport.type === 'stdio') || p.registryType === 'npm' || p.registryType === 'pypi'
  );
  const remote = (server.remotes || [])[0];

  if (pkg) {
    if (pkg.registryType === 'npm') {
      entry.command = 'npx';
      entry.args = ['-y', pkg.identifier];
    } else if (pkg.registryType === 'pypi') {
      entry.command = 'uvx';
      entry.args = [pkg.identifier];
    }
  } else if (remote) {
    entry.url = remote.url;
  }

  // Environment variables — merge registry-declared vars with user-provided ones
  entry.env = {};

  // Auto-populate from registry environmentVariables (packages + remotes)
  const envVars = server.environmentVariables || [];
  for (const ev of envVars) {
    if (ev.name && ev.format !== 'header') {
      // Use ${env:VAR} token so the user can set it in their environment
      entry.env[ev.name] = `\${env:${ev.name}}`;
    }
  }

  // User-provided env vars override auto-populated ones
  if (opts.env && typeof opts.env === 'object') {
    Object.assign(entry.env, opts.env);
  }

  // Required flag
  if (opts.required) {
    entry.required = true;
  }

  // AgentFlow extension fields
  if (server.description) {
    entry.description = server.description;
  }
  if (server.name) {
    entry.registryName = server.name;
  }
  if (server.version) {
    entry.version = server.version;
  }

  entry.discoveredTools = [];

  servers[name] = entry;
  saveMcpConfig(rootDir, servers);

  return entry;
}

/**
 * Removes a server entry from `.agentflow/mcp.json`.
 *
 * With `opts.removeTools`, also deletes generated tool `.md` files
 * listed in the server's `discoveredTools` array.
 *
 * @param {string} rootDir — workspace root directory
 * @param {string} name — server name to remove
 * @param {object} [opts={}] — options
 * @param {boolean} [opts.removeTools] — also delete generated tool .md files
 */
function removeServer(rootDir, name, opts = {}) {
  const { servers } = loadMcpConfig(rootDir);

  const entry = servers[name];
  if (!entry) {
    return;
  }

  // Optionally delete generated tool .md files
  if (opts.removeTools && Array.isArray(entry.discoveredTools)) {
    const toolsDir = path.join(rootDir, AGENTFLOW_DIR, 'capabilities');
    for (const toolName of entry.discoveredTools) {
      const toolPath = path.join(toolsDir, `${toolName}.md`);
      try {
        fs.unlinkSync(toolPath);
      } catch (_err) {
        // File may already be deleted — ignore
      }
    }
  }

  delete servers[name];
  saveMcpConfig(rootDir, servers);
}

/**
 * Resolves `${env:VAR}` tokens in an env object from `process.env`.
 *
 * Takes an env object (e.g. `{ GITHUB_TOKEN: "${env:GITHUB_TOKEN}", API_KEY: "literal" }`)
 * and returns a new object with tokens replaced by their values from `process.env`.
 * Non-token values are passed through unchanged.
 * If a referenced env var is not set in `process.env`, the token is replaced with an empty string.
 *
 * This function is used at connection time only (by MCP_Tool_Manager and MCP_Server_Lifecycle),
 * never during load/save.
 *
 * @param {object} env — env object with possible `${env:VAR}` tokens
 * @returns {object} new object with tokens resolved
 */
function resolveEnvTokens(env) {
  if (!env || typeof env !== 'object') {
    return {};
  }

  const resolved = {};
  const tokenPattern = /^\$\{env:([^}]+)\}$/;

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string') {
      resolved[key] = value;
      continue;
    }

    const match = value.match(tokenPattern);
    if (match) {
      const envVarName = match[1];
      resolved[key] = process.env[envVarName] ?? '';
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}



module.exports = {
  loadMcpConfig,
  saveMcpConfig,
  addServer,
  removeServer,
  resolveEnvTokens,
  mcpConfigPath,
  MCP_CONFIG_FILENAME,
  AGENTFLOW_DIR,
};
