import { validate } from '../../packages/core/src/validator';

/**
 * Helper: build a minimal graph with allFiles and mcpServers.
 */
function buildGraph({ allFiles = [], mcpServers, workflows = {} } = {}) {
  const graph = { allFiles, workflows, tools: {}, skills: {}, templates: {}, interactions: {}, memory: {}, customFiles: {} };
  if (mcpServers !== undefined) {
    graph.mcpServers = mcpServers;
  }
  return graph;
}

/**
 * Helper: build a tool file entry with type: mcp frontmatter.
 */
function mcpToolFile(name, server, opts = {}) {
  return {
    relativePath: `tools/${name}.md`,
    filePath: `tools/${name}.md`,
    resourceType: 'tool',
    frontmatter: {
      name,
      type: 'mcp',
      mcp: server,
      ...opts,
    },
    refs: [],
    content: `# ${name}`,
  };
}

describe('validate — MCP tool reference validation', () => {
  it('passes validation when mcp tool references a declared server', () => {
    const graph = buildGraph({
      allFiles: [mcpToolFile('github-create-issue', 'github')],
      mcpServers: {
        github: { command: 'npx', args: ['-y', '@mcp/github'] },
      },
    });

    const result = validate(graph);

    const mcpErrors = result.errors.filter(e => e.type === 'missing_mcp_server');
    const mcpWarnings = result.warnings.filter(w => w.type === 'orphaned_mcp_tool');
    expect(mcpErrors).toHaveLength(0);
    expect(mcpWarnings).toHaveLength(0);
  });

  it('produces warning when mcp tool references a missing server', () => {
    const graph = buildGraph({
      allFiles: [mcpToolFile('search-query', 'search-server')],
      mcpServers: {
        github: { command: 'npx', args: ['-y', '@mcp/github'] },
      },
    });

    const result = validate(graph);

    const mcpWarnings = result.warnings.filter(e => e.type === 'missing_mcp_server');
    expect(mcpWarnings).toHaveLength(1);
    expect(mcpWarnings[0].server).toBe('search-server');
    expect(mcpWarnings[0].message).toContain('search-query');
    expect(mcpWarnings[0].message).toContain('search-server');
    // Missing MCP server is a warning, not an error — tool just won't be available
    expect(result.valid).toBe(true);
  });

  it('produces orphaned warning for generated mcp tool with missing server', () => {
    const graph = buildGraph({
      allFiles: [mcpToolFile('old-tool', 'removed-server', { generated: true, generatedAt: '2025-01-01T00:00:00Z' })],
      mcpServers: {},
    });

    const result = validate(graph);

    const mcpWarnings = result.warnings.filter(e => e.type === 'missing_mcp_server');
    const orphanedWarnings = result.warnings.filter(w => w.type === 'orphaned_mcp_tool');
    expect(mcpWarnings).toHaveLength(1);
    expect(orphanedWarnings).toHaveLength(1);
    expect(orphanedWarnings[0].server).toBe('removed-server');
    expect(orphanedWarnings[0].message).toContain('Orphaned');
  });

  it('does not produce orphaned warning for non-generated mcp tool', () => {
    const graph = buildGraph({
      allFiles: [mcpToolFile('hand-authored', 'missing-server')],
      mcpServers: {},
    });

    const result = validate(graph);

    const mcpWarnings = result.warnings.filter(e => e.type === 'missing_mcp_server');
    const orphanedWarnings = result.warnings.filter(w => w.type === 'orphaned_mcp_tool');
    expect(mcpWarnings).toHaveLength(1);
    expect(orphanedWarnings).toHaveLength(0);
  });

  it('skips MCP validation when mcpServers is not present (backward compat)', () => {
    const graph = buildGraph({
      allFiles: [mcpToolFile('some-tool', 'some-server')],
      // no mcpServers — old workspace without mcp.json support
    });

    const result = validate(graph);

    const mcpErrors = result.errors.filter(e => e.type === 'missing_mcp_server');
    const orphanedWarnings = result.warnings.filter(w => w.type === 'orphaned_mcp_tool');
    expect(mcpErrors).toHaveLength(0);
    expect(orphanedWarnings).toHaveLength(0);
  });

  it('does not validate non-mcp tool files against mcpServers', () => {
    const graph = buildGraph({
      allFiles: [{
        relativePath: 'tools/run-tests.md',
        filePath: 'tools/run-tests.md',
        resourceType: 'tool',
        frontmatter: { name: 'run-tests', type: 'script', command: 'npm test' },
        refs: [],
        content: '# Run Tests',
      }],
      mcpServers: {},
    });

    const result = validate(graph);

    const mcpErrors = result.errors.filter(e => e.type === 'missing_mcp_server');
    expect(mcpErrors).toHaveLength(0);
  });

  it('validates multiple mcp tools — mixed valid and invalid', () => {
    const graph = buildGraph({
      allFiles: [
        mcpToolFile('github-issue', 'github'),
        mcpToolFile('slack-post', 'slack'),
        mcpToolFile('analytics-query', 'analytics'),
      ],
      mcpServers: {
        github: { command: 'npx', args: [] },
        analytics: { url: 'https://analytics.example.com/mcp' },
      },
    });

    const result = validate(graph);

    const mcpWarnings = result.warnings.filter(e => e.type === 'missing_mcp_server');
    expect(mcpWarnings).toHaveLength(1);
    expect(mcpWarnings[0].server).toBe('slack');
  });
});
