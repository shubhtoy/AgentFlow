'use strict';

/**
 * ToolProvider abstraction for the AgentFlow orchestrator.
 *
 * Replaces the inline BUILTIN_EXECUTORS / buildToolEntry / buildNodeTools
 * code from orchestrator.js with a clean, pluggable interface.
 *
 * ToolProvider is the base class. NodeToolProvider is the concrete
 * implementation for the standalone Node.js runtime, managing:
 *   - BuiltinToolRegistry (readCode, fsWrite, getDiagnostics, webSearch)
 *   - ScriptToolExecutor (runs shell commands)
 *   - McpToolManager (placeholder — task 7.2 implements the real thing)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { loadMcpConfig, resolveEnvTokens } = require('./config-manager');

// ---------------------------------------------------------------------------
// ToolProvider — base class / interface
// ---------------------------------------------------------------------------

/**
 * ToolProvider abstracts tool resolution and execution.
 * The orchestrator calls this — it never knows about tool types.
 *
 * Different platforms provide their own implementations:
 * - NodeToolProvider: standalone runtime (builtins + scripts + MCP)
 * - (future) KiroToolProvider: delegates to Kiro's built-in tools
 */
class ToolProvider {
  /**
   * Initialize the provider. For NodeToolProvider, this reads mcp.json
   * and connects to MCP servers.
   * @param {object} graph - Parsed WorkflowGraph from parseRoot()
   */
  async initialize(graph) {}

  /**
   * Get tools available for a specific node.
   * @param {object} node - The current workflow node
   * @param {object} graph - The full WorkflowGraph
   * @returns {{ name: string, schema: object, execute: Function }[]}
   */
  getToolsForNode(node, graph) {
    return [];
  }

  /**
   * Clean up. Kill MCP server processes, close connections.
   */
  async shutdown() {}
}

// ---------------------------------------------------------------------------
// BuiltinToolRegistry — the actual implementations behind builtin tools
// ---------------------------------------------------------------------------

const BuiltinToolRegistry = {
  /**
   * read-code / readCode: Read file contents. Accepts { path, symbol? }
   */
  readCode(args, ctx) {
    const filePath = path.resolve(ctx.workingDir, args.path);
    if (!fs.existsSync(filePath)) return { error: `File not found: ${args.path}` };
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(filePath, { withFileTypes: true });
      return {
        type: 'directory',
        path: args.path,
        entries: entries.map((e) => ({ name: e.name, isDir: e.isDirectory() })),
      };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (args.symbol) {
      const lines = content.split('\n');
      const matches = lines
        .map((line, i) => ({ line: i + 1, text: line }))
        .filter((l) => l.text.includes(args.symbol));
      return { path: args.path, symbol: args.symbol, matches: matches.slice(0, 30) };
    }
    // Cap at 500 lines to avoid blowing up context
    const lines = content.split('\n');
    const truncated = lines.length > 500;
    return {
      path: args.path,
      content: truncated ? lines.slice(0, 500).join('\n') + '\n...(truncated)' : content,
      lines: lines.length,
      truncated,
    };
  },

  /**
   * write-file / fsWrite: Write content to a file. Accepts { path, content }
   */
  fsWrite(args, ctx) {
    const filePath = path.resolve(ctx.workingDir, args.path);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, args.content, 'utf-8');
    return { success: true, path: args.path, bytesWritten: Buffer.byteLength(args.content) };
  },

  /**
   * get-diagnostics / getDiagnostics: Run linting/type-checking.
   */
  getDiagnostics(args, ctx) {
    const paths = args.paths || [args.path];
    const results = [];
    for (const p of paths) {
      const filePath = path.resolve(ctx.workingDir, p);
      if (!fs.existsSync(filePath)) {
        results.push({ path: p, error: 'File not found' });
        continue;
      }
      if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.cjs')) {
        try {
          execSync(`node --check "${filePath}"`, { stdio: 'pipe', timeout: 10000 });
          results.push({ path: p, ok: true, diagnostics: [] });
        } catch (err) {
          results.push({ path: p, ok: false, diagnostics: [err.stderr?.toString() || err.message] });
        }
      } else {
        results.push({ path: p, ok: true, diagnostics: [], note: 'No checker available for this file type' });
      }
    }
    return { results };
  },

  /**
   * web-search / webSearch: Stub — no real web search in the runtime.
   */
  webSearch(args) {
    return { note: 'Web search not available in orchestrator runtime', query: args.query };
  },
};

// ---------------------------------------------------------------------------
// ScriptToolExecutor — runs shell commands for script-type tools
// ---------------------------------------------------------------------------

const ScriptToolExecutor = {
  /**
   * Execute a script-type tool (runs a shell command).
   * @param {string} command - The shell command to run
   * @param {object} args - Tool arguments (may contain `command` override)
   * @param {object} ctx - Execution context with `workingDir`
   * @returns {object} execution result
   */
  execute(command, args, ctx) {
    const cmd = args.command || command;
    try {
      const output = execSync(cmd, {
        cwd: ctx.workingDir,
        stdio: 'pipe',
        timeout: 60000,
        encoding: 'utf-8',
      });
      return { success: true, command: cmd, output: output.slice(0, 10000) };
    } catch (err) {
      return {
        success: false,
        command: cmd,
        exitCode: err.status,
        output: (err.stdout || '').slice(0, 5000),
        error: (err.stderr || '').slice(0, 5000),
      };
    }
  },
};

// ---------------------------------------------------------------------------
// McpToolManager — manages MCP server connections, tool listing & execution
// ---------------------------------------------------------------------------

/**
 * Creates the default SDK dependencies.
 * Tests can override via opts._deps for dependency injection.
 */
function defaultMcpDeps() {
  return {
    createClient: (info) => new Client(info),
    createStdioTransport: (params) => new StdioClientTransport(params),
    createHTTPTransport: (url) => new StreamableHTTPClientTransport(url),
    resolveEnv: resolveEnvTokens,
  };
}

/**
 * McpToolManager manages MCP server connections and proxies tool calls.
 *
 * Stores connected clients in a Map: serverName → { client, transport, tools }
 *
 * On initialize: iterate servers from mcp.json, create transport, connect,
 * call tools/list to discover available tools.
 *
 * On execute: find the server's client, call tools/call via the SDK.
 *
 * On shutdown: iterate all clients, close each one (swallow individual errors).
 */
class McpToolManager {
  /**
   * @param {object} [opts={}]
   * @param {object} [opts._deps] — injectable dependencies (for testing)
   */
  constructor(opts = {}) {
    /** @type {Map<string, { client: object, tools: object[] }>} */
    this.servers = new Map();
    this._deps = { ...defaultMcpDeps(), ...opts._deps };
  }

  /**
   * Connect to each MCP server declared in the config.
   *
   * Required servers that fail → throw error with server name and install instructions.
   * Optional servers that fail → log warning, continue.
   *
   * @param {object} mcpConfig — result from loadMcpConfig() with { servers }
   */
  async initialize(mcpConfig) {
    const servers = (mcpConfig && mcpConfig.servers) || {};

    for (const [name, serverEntry] of Object.entries(servers)) {
      try {
        const { client, tools } = await this._connectServer(name, serverEntry);
        this.servers.set(name, { client, tools });
      } catch (err) {
        if (serverEntry.required) {
          const installCmd = serverEntry.command
            ? `${serverEntry.command} ${(serverEntry.args || []).join(' ')}`
            : serverEntry.url || 'unknown';
          throw new Error(
            `Required MCP server "${name}" failed to start: ${err.message}\n` +
            `Install: ${installCmd}`
          );
        }
        // Optional server — warn and continue
        console.warn(`Optional MCP server "${name}" unavailable: ${err.message}`);
      }
    }
  }

  /**
   * Connect to a single MCP server and list its tools.
   *
   * @param {string} name — server name (for client identity)
   * @param {object} serverEntry — server config from mcp.json
   * @returns {Promise<{ client: object, tools: object[] }>}
   * @private
   */
  async _connectServer(name, serverEntry) {
    const deps = this._deps;
    const resolvedEnv = deps.resolveEnv(serverEntry.env);

    let transport;
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

    const client = deps.createClient({ name: `agentflow-${name}`, version: '1.0.0' });
    await client.connect(transport);

    const result = await client.listTools();
    const tools = result.tools || [];

    return { client, tools };
  }

  /**
   * Return tools discovered from a specific server.
   *
   * @param {string} serverName
   * @returns {object[]} array of tool schemas from tools/list
   */
  getTools(serverName) {
    const entry = this.servers.get(serverName);
    return entry ? entry.tools : [];
  }

  /**
   * Proxy a tools/call JSON-RPC request to the connected MCP server.
   *
   * Handles server crashes during execution: catches errors and returns
   * an error result for the specific tool call without terminating the workflow.
   *
   * @param {string} server — server name
   * @param {string} tool — tool name
   * @param {object} args — tool arguments
   * @returns {Promise<object>} tool call result
   */
  async execute(server, tool, args) {
    const entry = this.servers.get(server);
    if (!entry) {
      return { error: `MCP server "${server}" is not connected. Configure and start the server to use this tool.` };
    }

    try {
      const result = await entry.client.callTool({ name: tool, arguments: args });
      return result;
    } catch (err) {
      // Server crash or communication error — report for this specific call
      return {
        error: `MCP tool "${tool}" on server "${server}" failed: ${err.message}`,
        isError: true,
      };
    }
  }

  /**
   * Terminate all server processes and close all connections.
   * Swallows individual shutdown errors to ensure all servers are attempted.
   */
  async shutdown() {
    const errors = [];
    for (const [name, entry] of this.servers) {
      try {
        if (entry.client && typeof entry.client.close === 'function') {
          await entry.client.close();
        }
      } catch (err) {
        errors.push({ server: name, error: err.message });
      }
    }
    this.servers.clear();
    // Errors are swallowed — the important thing is we tried to clean up everything
  }
}

// ---------------------------------------------------------------------------
// NodeToolProvider — concrete implementation for standalone Node.js runtime
// ---------------------------------------------------------------------------

/**
 * Build an Anthropic-format tool schema + executor from an AgentFlow tool def.
 *
 * Adapted from the old orchestrator.js buildToolEntry(). Returns:
 *   { name, schema, execute, toolType }
 *
 * @param {string} key - Tool key from graph.tools
 * @param {object} toolDef - Parsed tool definition from the graph
 * @param {McpToolManager} mcpManager - MCP tool manager instance
 * @returns {{ name: string, schema: object, execute: Function, toolType: string }}
 */
function buildToolEntry(key, toolDef, mcpManager) {
  const fm = toolDef.frontmatter || {};
  const name = fm.name || key;
  const description = fm.description || toolDef.title || toolDef.content || name;
  const toolType = fm.type || toolDef.toolType || 'builtin';

  // Build JSON schema for parameters from frontmatter
  const properties = {};
  const required = [];
  if (fm.parameters) {
    for (const [pName, pDef] of Object.entries(fm.parameters)) {
      properties[pName] = {
        type: pDef.type === 'array' ? 'array' : 'string',
        description: pDef.description || pName,
      };
      if (pDef.type === 'array') properties[pName].items = { type: 'string' };
      if (pDef.required) required.push(pName);
    }
  }

  // Default parameters for known builtins
  if (toolType === 'builtin' && Object.keys(properties).length === 0) {
    const mapping = fm.builtin_mapping || fm.builtinMapping || name;
    if (mapping === 'readCode' || mapping === 'read-code') {
      properties.path = { type: 'string', description: 'File or directory path to read' };
      properties.symbol = { type: 'string', description: 'Optional symbol name to search for' };
      required.push('path');
    } else if (mapping === 'fsWrite' || mapping === 'write-file') {
      properties.path = { type: 'string', description: 'File path to write' };
      properties.content = { type: 'string', description: 'Content to write' };
      required.push('path', 'content');
    } else if (mapping === 'getDiagnostics' || mapping === 'get-diagnostics') {
      properties.paths = { type: 'array', items: { type: 'string' }, description: 'File paths to check' };
      required.push('paths');
    } else if (mapping === 'webSearch' || mapping === 'web-search') {
      properties.query = { type: 'string', description: 'Search query' };
      required.push('query');
    }
  }

  // Default parameters for script tools
  if (toolType === 'script' && Object.keys(properties).length === 0) {
    properties.command = { type: 'string', description: `Shell command to run (default: ${fm.command || 'sh'})` };
  }

  const schema = {
    name: name.replace(/[^a-zA-Z0-9_-]/g, '_'),
    description: typeof description === 'string' ? description.slice(0, 1024) : name,
    input_schema: {
      type: 'object',
      properties,
      required,
    },
  };

  // Build executor
  let execute;
  if (toolType === 'builtin') {
    const mapping = fm.builtin_mapping || fm.builtinMapping || name;
    const builtinFn = BuiltinToolRegistry[mapping] || BuiltinToolRegistry[name];
    if (builtinFn) {
      execute = (args, ctx) => builtinFn(args, ctx);
    } else {
      execute = () => ({ error: `No executor for builtin: ${mapping}` });
    }
  } else if (toolType === 'script') {
    execute = (args, ctx) => ScriptToolExecutor.execute(fm.command, args, ctx);
  } else if (toolType === 'mcp') {
    const serverName = fm.mcp || '';
    execute = (args) => mcpManager.execute(serverName, name, args);
  } else {
    execute = () => ({ error: `Unknown tool type: ${toolType}` });
  }

  return { name: schema.name, schema, execute, toolType };
}

class NodeToolProvider extends ToolProvider {
  /**
   * @param {object} [opts={}]
   * @param {object} [opts._deps] — injectable MCP dependencies (for testing)
   */
  constructor(opts = {}) {
    super();
    this.mcpManager = new McpToolManager(opts);
    this.rootDir = null;
  }

  /**
   * Initialize the provider. Reads mcp.json and connects to MCP servers.
   * @param {object} graph - Parsed WorkflowGraph from parseRoot()
   */
  async initialize(graph) {
    this.rootDir = graph.rootDir || null;

    // Load MCP config if available
    if (this.rootDir) {
      const mcpConfig = loadMcpConfig(this.rootDir);
      if (Object.keys(mcpConfig.servers).length > 0) {
        await this.mcpManager.initialize(mcpConfig);
      }
    }
  }

  /**
   * Get tools available for a specific node.
   *
   * Resolves tool references from the node's markdown refs and frontmatter
   * context.inputs, then builds unified { name, schema, execute } entries
   * for builtin, script, and MCP tools.
   *
   * @param {object} node - The current workflow node
   * @param {object} graph - The full WorkflowGraph
   * @returns {{ name: string, schema: object, execute: Function }[]}
   */
  getToolsForNode(node, graph) {
    const toolMap = {};

    // 1. Capabilities from {{capabilities/...}} refs in markdown body
    for (const ref of (node.allRefs || [])) {
      if (ref.semanticType !== 'mention') continue;
      if (ref.category !== 'capabilities' && ref.category !== 'tools') continue;

      const toolName = ref.name;
      const toolDef = (graph.capabilities || graph.tools || {})[toolName];
      if (!toolDef) continue;

      const entry = buildToolEntry(toolName, toolDef, this.mcpManager);
      toolMap[entry.name] = entry;
    }

    // 2. Tools from frontmatter context.inputs
    const inputs = (node.frontmatter && node.frontmatter.context && node.frontmatter.context.inputs) || [];
    for (const input of inputs) {
      if (!input.ref) continue;
      const parts = input.ref.split('/');
      if (parts[0] !== 'capabilities' && parts[0] !== 'tools') continue;
      const toolName = parts.slice(1).join('/');
      if (toolMap[toolName]) continue; // already added

      const toolDef = (graph.capabilities || graph.tools || {})[toolName];
      if (!toolDef) continue;

      const entry = buildToolEntry(toolName, toolDef, this.mcpManager);
      toolMap[entry.name] = entry;
    }

    // Return as array of { name, schema, execute }
    return Object.values(toolMap);
  }

  /**
   * Clean up. Shuts down MCP server processes and connections.
   */
  async shutdown() {
    await this.mcpManager.shutdown();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  ToolProvider,
  NodeToolProvider,
  BuiltinToolRegistry,
  ScriptToolExecutor,
  McpToolManager,
  buildToolEntry,
  defaultMcpDeps,
};
