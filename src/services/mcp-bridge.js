'use strict';

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const fs = require('fs');

/**
 * Default MCP server configurations.
 * Used when no protocols.json exists in the workspace.
 */
const DEFAULT_SERVERS = {
  filesystem: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '{rootDir}'],
    enabled: true,
  },
  git: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git', '--repository', '{rootDir}'],
    enabled: true,
  },
  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: true,
  },
  fetch: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    enabled: true,
  },
  sequentialthinking: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
    enabled: true,
  },
};

/**
 * Create an MCP Bridge that spawns and manages official MCP servers.
 * @param {{ rootDir: string, logger: object }} ctx
 */
function createMCPBridge(ctx) {
  const { rootDir, logger } = ctx;
  /** @type {Map<string, { client: any, transport: any }>} */
  const connections = new Map();
  /** @type {Map<string, object[]>} */
  const toolCache = new Map();
  let initialized = false;

  /**
   * Load server config from protocols.json or use defaults.
   */
  function loadServerConfig() {
    const configPath = path.join(rootDir, 'protocols.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return (raw.mcp && raw.mcp.servers) || raw.servers || DEFAULT_SERVERS;
      } catch (err) {
        logger.warn({ err }, 'Failed to parse protocols.json, using defaults');
      }
    }
    return DEFAULT_SERVERS;
  }

  /**
   * Replace {rootDir} placeholders in args/env.
   */
  function resolveTemplate(value) {
    if (typeof value === 'string') return value.replace(/\{rootDir\}/g, rootDir);
    return value;
  }

  return {
    /**
     * Spawn all enabled MCP servers.
     */
    async initialize() {
      if (initialized) return;
      const servers = loadServerConfig();

      for (const [name, cfg] of Object.entries(servers)) {
        if (cfg.enabled === false || cfg.disabled) continue;
        try {
          const args = (cfg.args || []).map(resolveTemplate);
          const env = {};
          if (cfg.env) {
            for (const [k, v] of Object.entries(cfg.env)) {
              env[k] = resolveTemplate(v);
            }
          }

          const transport = new StdioClientTransport({
            command: cfg.command || 'npx',
            args,
            env: { ...process.env, ...env },
          });

          const client = new Client({ name: `agentflow-${name}`, version: '1.0.0' });
          await client.connect(transport);

          connections.set(name, { client, transport });
          logger.info(`MCP server "${name}" connected`);
        } catch (err) {
          logger.error({ err }, `Failed to spawn MCP server "${name}"`);
        }
      }
      initialized = true;
    },

    /**
     * Get tool definitions from all connected MCP servers,
     * formatted for LLM function calling.
     */
    async getToolDefinitions() {
      const allTools = [];

      for (const [serverName, { client }] of connections) {
        if (toolCache.has(serverName)) {
          allTools.push(...toolCache.get(serverName));
          continue;
        }
        try {
          const result = await client.listTools();
          const tools = (result.tools || []).map(t => ({
            server: serverName,
            name: t.name,
            description: t.description || '',
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
          }));
          toolCache.set(serverName, tools);
          allTools.push(...tools);
        } catch (err) {
          logger.error({ err }, `Failed to list tools from "${serverName}"`);
        }
      }

      return allTools;
    },

    /**
     * Call a tool on a specific MCP server.
     */
    async callTool(serverName, toolName, args) {
      const conn = connections.get(serverName);
      if (!conn) throw new Error(`MCP server "${serverName}" not connected`);

      const result = await conn.client.callTool({ name: toolName, arguments: args });
      // MCP returns { content: [{ type, text }] }
      const textParts = (result.content || [])
        .filter(c => c.type === 'text')
        .map(c => c.text);
      return textParts.join('\n') || JSON.stringify(result.content);
    },

    /**
     * Find which server owns a tool by name.
     */
    async findToolServer(toolName) {
      const allTools = await this.getToolDefinitions();
      const match = allTools.find(t => t.name === toolName);
      return match ? match.server : null;
    },

    /**
     * Kill all child processes.
     */
    async shutdown() {
      for (const [name, { client, transport }] of connections) {
        try {
          await client.close();
        } catch (_) {}
        try {
          if (transport.close) await transport.close();
        } catch (_) {}
        logger.info(`MCP server "${name}" shut down`);
      }
      connections.clear();
      toolCache.clear();
      initialized = false;
    },

    /** Check if initialized */
    isInitialized() { return initialized; },
  };
}

module.exports = { createMCPBridge, DEFAULT_SERVERS };
