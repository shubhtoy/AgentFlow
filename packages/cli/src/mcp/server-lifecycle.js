/**
 * MCP Server Lifecycle — temporary server processes for tool discovery.
 *
 * Spawns stdio processes or connects to HTTP/SSE endpoints using
 * @modelcontextprotocol/sdk, calls tools/list, and always cleans up.
 *
 * Environment variable tokens (`${env:VAR}`) are resolved at connection
 * time via resolveEnvTokens() — never stored resolved.
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { resolveEnvTokens } = require('./config-manager');

const DEFAULT_TIMEOUT = 30000;

/**
 * Creates the default SDK dependencies.
 * Exposed for testing — tests can override via opts._deps.
 */
function defaultDeps() {
  return {
    createClient: (info) => new Client(info),
    createStdioTransport: (params) => new StdioClientTransport(params),
    createHTTPTransport: (url) => new StreamableHTTPClientTransport(url),
    resolveEnv: resolveEnvTokens,
  };
}

/**
 * Discovers tools from an MCP server by temporarily connecting to it.
 *
 * Determines transport type from serverEntry:
 * - `command` + `args` → stdio (spawn process)
 * - `url` → HTTP/SSE (connect to remote)
 *
 * Resolves `${env:VAR}` tokens in the env object before spawning.
 * Always cleans up (kills process / disconnects) in a finally block.
 *
 * @param {object} serverEntry — server config from mcp.json
 * @param {string} [serverEntry.command] — command for stdio transport
 * @param {string[]} [serverEntry.args] — args for stdio transport
 * @param {string} [serverEntry.url] — URL for HTTP/SSE transport
 * @param {object} [serverEntry.env] — env vars with possible ${env:VAR} tokens
 * @param {object} [opts={}] — options
 * @param {number} [opts.timeout=30000] — connection timeout in ms
 * @param {object} [opts._deps] — injectable dependencies (for testing)
 * @returns {Promise<object[]>} array of tool schemas from tools/list
 */
async function discoverTools(serverEntry, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const deps = { ...defaultDeps(), ...opts._deps };
  const resolvedEnv = deps.resolveEnv(serverEntry.env);

  let transport;
  let client;

  try {
    // Determine transport type
    if (serverEntry.command) {
      transport = deps.createStdioTransport({
        command: serverEntry.command,
        args: serverEntry.args || [],
        env: { ...process.env, ...resolvedEnv },
      });
    } else if (serverEntry.url) {
      transport = deps.createHTTPTransport(new URL(serverEntry.url));
    } else {
      throw new Error('Server entry must have either "command" (stdio) or "url" (HTTP/SSE)');
    }

    // Create client and connect with timeout
    client = deps.createClient({ name: 'agentflow-discovery', version: '1.0.0' });

    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timed out after ${timeout}ms`)), timeout)
      ),
    ]);

    // Call tools/list
    const result = await client.listTools();
    return result.tools || [];
  } finally {
    // Always clean up
    try {
      if (client) {
        await client.close();
      }
    } catch (_err) {
      // Swallow cleanup errors — the important thing is we tried
    }
  }
}

module.exports = {
  discoverTools,
  DEFAULT_TIMEOUT,
};
