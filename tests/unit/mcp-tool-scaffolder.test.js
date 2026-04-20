const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');

const {
  scaffoldTools,
  toFileName,
  convertParameters,
  generateToolContent,
} = require('../../packages/cli/src/mcp/tool-scaffolder');

const { loadMcpConfig, saveMcpConfig } = require('../../packages/cli/src/mcp/config-manager');
const { parseMarkdownFile, classifyResource } = require('../../packages/cli/src/parser');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-scaffolder-'));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function setupMcpConfig(rootDir, serverName) {
  const servers = {
    [serverName]: {
      command: 'npx',
      args: ['-y', '@mcp/test-server'],
      env: {},
      discoveredTools: [],
    },
  };
  saveMcpConfig(rootDir, servers);
}

const SAMPLE_TOOLS = [
  {
    name: 'create_issue',
    description: 'Create a new issue in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'list_issues',
    description: 'List issues in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', description: 'Issue state filter' },
      },
      required: ['owner', 'repo'],
    },
  },
];

const SERVER_NAME = 'io.github.modelcontextprotocol/github';

/* ------------------------------------------------------------------ */
/*  toFileName                                                         */
/* ------------------------------------------------------------------ */

describe('toFileName', () => {
  it('converts underscores to hyphens', () => {
    expect(toFileName('create_issue')).toBe('create-issue');
  });

  it('converts spaces to hyphens', () => {
    expect(toFileName('create issue')).toBe('create-issue');
  });

  it('lowercases the name', () => {
    expect(toFileName('Create_Issue')).toBe('create-issue');
  });

  it('handles already kebab-case names', () => {
    expect(toFileName('create-issue')).toBe('create-issue');
  });

  it('strips non-alphanumeric non-hyphen characters', () => {
    expect(toFileName('create@issue!')).toBe('createissue');
  });
});

/* ------------------------------------------------------------------ */
/*  convertParameters                                                  */
/* ------------------------------------------------------------------ */

describe('convertParameters', () => {
  it('converts JSON Schema properties to AgentFlow format', () => {
    const schema = {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
      },
      required: ['owner'],
    };

    const params = convertParameters(schema);

    expect(params.owner).toEqual({
      type: 'string',
      description: 'Repository owner',
      required: true,
    });
    expect(params.repo).toEqual({
      type: 'string',
      description: 'Repository name',
      required: false,
    });
  });

  it('returns empty object for null schema', () => {
    expect(convertParameters(null)).toEqual({});
  });

  it('returns empty object for schema without properties', () => {
    expect(convertParameters({ type: 'object' })).toEqual({});
  });

  it('handles schema with no required array', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'A name' },
      },
    };

    const params = convertParameters(schema);
    expect(params.name.required).toBe(false);
  });

  it('handles properties without description', () => {
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
      required: ['count'],
    };

    const params = convertParameters(schema);
    expect(params.count).toEqual({ type: 'number', required: true });
  });
});

/* ------------------------------------------------------------------ */
/*  scaffoldTools                                                      */
/* ------------------------------------------------------------------ */

describe('scaffoldTools', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
    setupMcpConfig(tmpDir, SERVER_NAME);
  });
  afterEach(() => { removeTmpDir(tmpDir); });

  it('generates one .md file per tool', () => {
    const paths = scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    expect(paths).toHaveLength(2);
    expect(paths).toContain(path.join('.agentflow', 'capabilities', 'create-issue.md'));
    expect(paths).toContain(path.join('.agentflow', 'capabilities', 'list-issues.md'));

    // Files should exist on disk
    for (const p of paths) {
      expect(fs.existsSync(path.join(tmpDir, p))).toBe(true);
    }
  });

  it('creates .agentflow/capabilities/ directory if it does not exist', () => {
    const capsDir = path.join(tmpDir, '.agentflow', 'capabilities');
    // Remove tools dir if it exists
    if (fs.existsSync(capsDir)) {
      fs.rmSync(capsDir, { recursive: true });
    }

    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    expect(fs.existsSync(capsDir)).toBe(true);
  });

  it('includes correct frontmatter fields', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'create-issue.md');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);

    expect(parsed.data.name).toBe('create-issue');
    expect(parsed.data.type).toBe('mcp');
    expect(parsed.data.mcp).toBe(SERVER_NAME);
    expect(parsed.data.description).toBe('Create a new issue in a repository');
    expect(parsed.data.generated).toBe(true);
    expect(parsed.data.generatedAt).toBeDefined();
    // Verify ISO timestamp format
    expect(() => new Date(parsed.data.generatedAt)).not.toThrow();
    expect(new Date(parsed.data.generatedAt).toISOString()).toBe(parsed.data.generatedAt);
  });

  it('converts inputSchema to parameters frontmatter', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'create-issue.md');
    const parsed = matter(fs.readFileSync(filePath, 'utf-8'));

    expect(parsed.data.parameters.owner).toEqual({
      type: 'string',
      description: 'Repository owner',
      required: true,
    });
    expect(parsed.data.parameters.title).toEqual({
      type: 'string',
      description: 'Issue title',
      required: true,
    });
  });

  it('skips existing files when overwrite is false', () => {
    // First scaffold
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    // Write a marker to the file
    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'create-issue.md');
    const originalContent = fs.readFileSync(filePath, 'utf-8');

    // Second scaffold without overwrite — should skip
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const paths = scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);
    warnSpy.mockRestore();

    expect(paths).toHaveLength(0);
    // File content should be unchanged
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(originalContent);
  });

  it('warns when skipping existing files', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toMatch(/Skipping existing tool file/);
    warnSpy.mockRestore();
  });

  it('overwrites existing files when opts.overwrite is true', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const paths = scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS, { overwrite: true });

    expect(paths).toHaveLength(2);
  });

  it('updates discoveredTools in mcp.json', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const { servers } = loadMcpConfig(tmpDir);
    const discoveredTools = servers[SERVER_NAME].discoveredTools;

    expect(discoveredTools).toContain('create-issue');
    expect(discoveredTools).toContain('list-issues');
    expect(discoveredTools).toHaveLength(2);
  });

  it('skips tools with no name', () => {
    const tools = [
      { name: 'valid_tool', description: 'Valid', inputSchema: { type: 'object', properties: {} } },
      { description: 'No name' },
      null,
    ];

    const paths = scaffoldTools(tmpDir, SERVER_NAME, tools);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain('valid-tool.md');
  });

  it('handles empty tools array', () => {
    const paths = scaffoldTools(tmpDir, SERVER_NAME, []);

    expect(paths).toHaveLength(0);
  });

  it('handles tools with no inputSchema', () => {
    const tools = [
      { name: 'simple_tool', description: 'A simple tool' },
    ];

    const paths = scaffoldTools(tmpDir, SERVER_NAME, tools);

    expect(paths).toHaveLength(1);

    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'simple-tool.md');
    const parsed = matter(fs.readFileSync(filePath, 'utf-8'));
    expect(parsed.data.parameters).toEqual({});
  });

  it('generated files pass parseMarkdownFile()', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'create-issue.md');
    const parsed = parseMarkdownFile(filePath);

    expect(parsed).not.toBeNull();
    expect(parsed.frontmatter.type).toBe('mcp');
    expect(parsed.frontmatter.name).toBe('create-issue');
    expect(parsed.frontmatter.mcp).toBe(SERVER_NAME);
    expect(parsed.frontmatter.generated).toBe(true);
  });

  it('generated files pass classifyResource() as tool type', () => {
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS);

    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'create-issue.md');
    const parsed = parseMarkdownFile(filePath);

    // classifyResource uses frontmatter.type first, then directory inference
    // Since type is 'mcp', it should return 'mcp'
    const resourceType = classifyResource(parsed, 'capabilities');
    expect(resourceType).toBe('mcp');
  });

  it('produces idempotent output with overwrite', () => {
    // First run
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS, { overwrite: true });
    const filePath = path.join(tmpDir, '.agentflow', 'capabilities', 'create-issue.md');
    const first = matter(fs.readFileSync(filePath, 'utf-8'));

    // Second run with overwrite — content should be structurally identical
    // (generatedAt will differ, but structure is the same)
    scaffoldTools(tmpDir, SERVER_NAME, SAMPLE_TOOLS, { overwrite: true });
    const second = matter(fs.readFileSync(filePath, 'utf-8'));

    expect(second.data.name).toBe(first.data.name);
    expect(second.data.type).toBe(first.data.type);
    expect(second.data.mcp).toBe(first.data.mcp);
    expect(second.data.description).toBe(first.data.description);
    expect(second.data.parameters).toEqual(first.data.parameters);
    expect(second.data.generated).toBe(first.data.generated);
  });
});
