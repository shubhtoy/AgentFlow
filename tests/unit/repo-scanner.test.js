const fs = require('fs');
const path = require('path');
const os = require('os');
const fc = require('fast-check');

const {
  scan,
  scanIncremental,
  findAgentflowDirs,
  RESERVED_DIRS,
} = require('../../packages/cli/src/git/repo-scanner');

const {
  simpleTreeArb,
  complexTreeArb,
  directoryTreeArb,
  reservedDirFilesArb,
  workflowArb,
  agentsFileArb,
} = require('../generators/directory.gen.js');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-scan-'));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Materialize a generated directory tree into a temp .agentflow/ directory.
 * `tree` is the output of directoryTreeArb: { files: [{ path, content }], ... }
 * Returns the root dir (parent of .agentflow/).
 */
function materializeTree(tree) {
  const rootDir = createTmpDir();
  const afDir = path.join(rootDir, '.agentflow');

  for (const file of tree.files) {
    const fullPath = path.join(afDir, file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, 'utf-8');
  }

  return rootDir;
}

/* ------------------------------------------------------------------ */
/*  Property 1: Scan completeness                                      */
/* ------------------------------------------------------------------ */

describe('scan completeness (Property 1)', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any repository directory containing one or more .agentflow/ directories
   * within the configured scan depth, the RepoScanner shall discover every such
   * directory.
   */
  it('discovers every .agentflow/ within depth', () => {
    fc.assert(
      fc.property(directoryTreeArb, (tree) => {
        const rootDir = materializeTree(tree);
        try {
          const result = scan(rootDir, 10);
          // The tree was materialized under rootDir/.agentflow/
          expect(result.agentflowPaths).toContain('.agentflow');
          expect(result.agentflowPaths.length).toBeGreaterThanOrEqual(1);
        } finally {
          removeTmpDir(rootDir);
        }
      }),
      { numRuns: 10 },
    );
  });

  it('finds .agentflow/ at root level', () => {
    const rootDir = createTmpDir();
    try {
      const afDir = path.join(rootDir, '.agentflow');
      fs.mkdirSync(afDir);
      fs.writeFileSync(path.join(afDir, 'AGENTS.md'), '# Root', 'utf-8');

      const result = scan(rootDir, 5);
      expect(result.agentflowPaths).toContain('.agentflow');
    } finally {
      removeTmpDir(rootDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Resource categorization by directory name                          */
/* ------------------------------------------------------------------ */

describe('resource categorization by directory name', () => {
  it('categorizes resources into correct types based on directory', () => {
    const rootDir = createTmpDir();
    try {
      const afDir = path.join(rootDir, '.agentflow');
      // Create one file in each reserved directory
      for (const dir of RESERVED_DIRS) {
        const dirPath = path.join(afDir, dir);
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(
          path.join(dirPath, 'test-resource.md'),
          `---\nname: test-${dir}\n---\n# Test ${dir}\n`,
          'utf-8',
        );
      }

      const result = scan(rootDir, 5);

      for (const dir of RESERVED_DIRS) {
        expect(result.resources[dir].length).toBe(1);
        expect(result.resources[dir][0].resourceType).toBe(dir);
        expect(result.resources[dir][0].name).toBe(`test-${dir}`);
      }
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('uses filename as name when frontmatter has no name field', () => {
    const rootDir = createTmpDir();
    try {
      const capabilitiesDir = path.join(rootDir, '.agentflow', 'capabilities');
      fs.mkdirSync(capabilitiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(capabilitiesDir, 'my-tool.md'),
        '# My Tool\n\nNo frontmatter here.\n',
        'utf-8',
      );

      const result = scan(rootDir, 5);
      expect(result.resources.capabilities[0].name).toBe('my-tool');
      expect(result.resources.capabilities[0].hasFrontmatter).toBe(false);
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('categorizes resources from generated trees correctly', () => {
    fc.assert(
      fc.property(simpleTreeArb, (tree) => {
        const rootDir = materializeTree(tree);
        try {
          const result = scan(rootDir, 10);

          // Every resource in the tree should be categorized
          for (const dir of RESERVED_DIRS) {
            const treeFiles = tree.files.filter(
              (f) => f.path.startsWith(`${dir}/`) && f.path.endsWith('.md'),
            );
            expect(result.resources[dir].length).toBe(treeFiles.length);
          }
        } finally {
          removeTmpDir(rootDir);
        }
      }),
      { numRuns: 10 },
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Workflow detection via AGENTS.md                                   */
/* ------------------------------------------------------------------ */

describe('workflow detection via AGENTS.md', () => {
  it('detects a workflow directory with AGENTS.md', () => {
    const rootDir = createTmpDir();
    try {
      const wfDir = path.join(rootDir, '.agentflow', 'my-workflow');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(
        path.join(wfDir, 'AGENTS.md'),
        '---\ntype: agents\nname: My Workflow\n---\n# My Workflow\n',
        'utf-8',
      );
      // Add a node subdirectory
      const nodeDir = path.join(wfDir, 'step1');
      fs.mkdirSync(nodeDir);
      fs.writeFileSync(path.join(nodeDir, 'SKILL.md'), '# Step 1\n', 'utf-8');

      const result = scan(rootDir, 5);
      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].name).toBe('my-workflow');
      expect(result.workflows[0].hasDescriptor).toBe(true);
      expect(result.workflows[0].nodeCount).toBe(1);
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('detects workflow via type: agents frontmatter (not AGENTS.md filename)', () => {
    const rootDir = createTmpDir();
    try {
      const wfDir = path.join(rootDir, '.agentflow', 'alt-workflow');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(
        path.join(wfDir, 'descriptor.md'),
        '---\ntype: agents\nname: Alt\n---\n# Alt Workflow\n',
        'utf-8',
      );
      const nodeDir = path.join(wfDir, 'task1');
      fs.mkdirSync(nodeDir);
      fs.writeFileSync(path.join(nodeDir, 'main.md'), '# Task 1\n', 'utf-8');

      const result = scan(rootDir, 5);
      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].name).toBe('alt-workflow');
      expect(result.workflows[0].hasDescriptor).toBe(true);
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('does not detect directories without AGENTS.md as workflows', () => {
    const rootDir = createTmpDir();
    try {
      const notWfDir = path.join(rootDir, '.agentflow', 'not-a-workflow');
      fs.mkdirSync(notWfDir, { recursive: true });
      fs.writeFileSync(path.join(notWfDir, 'readme.md'), '# Readme\n', 'utf-8');

      const result = scan(rootDir, 5);
      expect(result.workflows).toHaveLength(0);
    } finally {
      removeTmpDir(rootDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Mono-repo: multiple .agentflow/ dirs at different nesting levels   */
/* ------------------------------------------------------------------ */

describe('mono-repo: multiple .agentflow/ dirs', () => {
  it('discovers multiple .agentflow/ dirs at different nesting levels', () => {
    const rootDir = createTmpDir();
    try {
      // Root-level .agentflow
      const af1 = path.join(rootDir, '.agentflow');
      fs.mkdirSync(af1);
      fs.writeFileSync(path.join(af1, 'AGENTS.md'), '# Root\n', 'utf-8');

      // Nested project-a/.agentflow
      const af2 = path.join(rootDir, 'project-a', '.agentflow');
      fs.mkdirSync(af2, { recursive: true });
      fs.writeFileSync(path.join(af2, 'AGENTS.md'), '# Project A\n', 'utf-8');

      // Deeply nested project-b/sub/.agentflow
      const af3 = path.join(rootDir, 'project-b', 'sub', '.agentflow');
      fs.mkdirSync(af3, { recursive: true });
      fs.writeFileSync(path.join(af3, 'AGENTS.md'), '# Project B Sub\n', 'utf-8');

      const result = scan(rootDir, 5);
      expect(result.agentflowPaths).toHaveLength(3);
      expect(result.agentflowPaths).toContain('.agentflow');
      expect(result.agentflowPaths).toContain(path.join('project-a', '.agentflow'));
      expect(result.agentflowPaths).toContain(path.join('project-b', 'sub', '.agentflow'));
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('aggregates resources from multiple .agentflow/ dirs', () => {
    const rootDir = createTmpDir();
    try {
      // Two .agentflow dirs, each with a capability
      const af1Capabilities = path.join(rootDir, '.agentflow', 'capabilities');
      fs.mkdirSync(af1Capabilities, { recursive: true });
      fs.writeFileSync(
        path.join(af1Capabilities, 'tool-a.md'),
        '---\nname: tool-a\n---\n# Tool A\n',
        'utf-8',
      );

      const af2Capabilities = path.join(rootDir, 'sub', '.agentflow', 'capabilities');
      fs.mkdirSync(af2Capabilities, { recursive: true });
      fs.writeFileSync(
        path.join(af2Capabilities, 'tool-b.md'),
        '---\nname: tool-b\n---\n# Tool B\n',
        'utf-8',
      );

      const result = scan(rootDir, 5);
      expect(result.resources.capabilities).toHaveLength(2);
      const names = result.resources.capabilities.map((t) => t.name);
      expect(names).toContain('tool-a');
      expect(names).toContain('tool-b');
    } finally {
      removeTmpDir(rootDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  scanDepth limit respected                                          */
/* ------------------------------------------------------------------ */

describe('scanDepth limit respected', () => {
  it('does not find .agentflow/ beyond maxDepth', () => {
    const rootDir = createTmpDir();
    try {
      // .agentflow at depth 0 — should be found with maxDepth >= 1
      const af1 = path.join(rootDir, '.agentflow');
      fs.mkdirSync(af1);
      fs.writeFileSync(path.join(af1, 'AGENTS.md'), '# Root\n', 'utf-8');

      // .agentflow at depth 3 — a/b/c/.agentflow
      const af2 = path.join(rootDir, 'a', 'b', 'c', '.agentflow');
      fs.mkdirSync(af2, { recursive: true });
      fs.writeFileSync(path.join(af2, 'AGENTS.md'), '# Deep\n', 'utf-8');

      // maxDepth=1 should only find root .agentflow
      const shallow = scan(rootDir, 1);
      expect(shallow.agentflowPaths).toContain('.agentflow');
      expect(shallow.agentflowPaths).not.toContain(path.join('a', 'b', 'c', '.agentflow'));

      // maxDepth=5 should find both
      const deep = scan(rootDir, 5);
      expect(deep.agentflowPaths).toHaveLength(2);
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('maxDepth=0 finds nothing (no directories traversed)', () => {
    const rootDir = createTmpDir();
    try {
      const af = path.join(rootDir, '.agentflow');
      fs.mkdirSync(af);
      fs.writeFileSync(path.join(af, 'AGENTS.md'), '# Root\n', 'utf-8');

      const result = scan(rootDir, 0);
      expect(result.agentflowPaths).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toMatch(/No .agentflow directory found/);
    } finally {
      removeTmpDir(rootDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Error Scenario 6: No .agentflow directory found                    */
/* ------------------------------------------------------------------ */

describe('no .agentflow directory found (Error Scenario 6)', () => {
  it('returns empty result with warning when no .agentflow/ exists', () => {
    const rootDir = createTmpDir();
    try {
      // Create some random files but no .agentflow
      fs.writeFileSync(path.join(rootDir, 'readme.md'), '# Readme\n', 'utf-8');

      const result = scan(rootDir, 5);
      expect(result.agentflowPaths).toHaveLength(0);
      expect(result.resources.capabilities).toHaveLength(0);
      expect(result.resources.instructions).toHaveLength(0);
      expect(result.workflows).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].message).toMatch(/No .agentflow directory found/);
    } finally {
      removeTmpDir(rootDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Property 6: Scan result accuracy (stats)                           */
/* ------------------------------------------------------------------ */

describe('stats accuracy (Property 6)', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any ScanResult, stats.totalFiles shall equal the sum of all resources
   * plus the sum of nodeCount across all workflows. stats.totalWorkflows shall
   * equal the length of the workflows array. stats.totalResources shall equal
   * the sum of resources across all resource type arrays.
   */
  it('stats match actual resource and workflow counts', () => {
    fc.assert(
      fc.property(directoryTreeArb, (tree) => {
        const rootDir = materializeTree(tree);
        try {
          const result = scan(rootDir, 10);

          // totalResources = sum of all resource arrays
          const actualTotalResources = RESERVED_DIRS.reduce(
            (sum, type) => sum + result.resources[type].length, 0,
          );
          expect(result.stats.totalResources).toBe(actualTotalResources);

          // totalWorkflows = length of workflows array
          expect(result.stats.totalWorkflows).toBe(result.workflows.length);

          // totalFiles = totalResources + sum of nodeCount
          const totalNodeCount = result.workflows.reduce((sum, wf) => sum + wf.nodeCount, 0);
          expect(result.stats.totalFiles).toBe(actualTotalResources + totalNodeCount);

          // scanDurationMs should be non-negative
          expect(result.stats.scanDurationMs).toBeGreaterThanOrEqual(0);
        } finally {
          removeTmpDir(rootDir);
        }
      }),
      { numRuns: 10 },
    );
  });

  it('stats are correct for a hand-crafted tree', () => {
    const rootDir = createTmpDir();
    try {
      const afDir = path.join(rootDir, '.agentflow');

      // 2 capabilities
      const capabilitiesDir = path.join(afDir, 'capabilities');
      fs.mkdirSync(capabilitiesDir, { recursive: true });
      fs.writeFileSync(path.join(capabilitiesDir, 'a.md'), '---\nname: a\n---\n# A\n', 'utf-8');
      fs.writeFileSync(path.join(capabilitiesDir, 'b.md'), '---\nname: b\n---\n# B\n', 'utf-8');

      // 1 instruction
      const instructionsDir = path.join(afDir, 'instructions');
      fs.mkdirSync(instructionsDir, { recursive: true });
      fs.writeFileSync(path.join(instructionsDir, 'c.md'), '# C\n', 'utf-8');

      // 1 workflow with 2 nodes
      const wfDir = path.join(afDir, 'my-wf');
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, 'AGENTS.md'), '---\ntype: agents\n---\n# WF\n', 'utf-8');
      fs.mkdirSync(path.join(wfDir, 'step1'));
      fs.writeFileSync(path.join(wfDir, 'step1', 'main.md'), '# Step 1\n', 'utf-8');
      fs.mkdirSync(path.join(wfDir, 'step2'));
      fs.writeFileSync(path.join(wfDir, 'step2', 'main.md'), '# Step 2\n', 'utf-8');

      const result = scan(rootDir, 5);

      expect(result.stats.totalResources).toBe(3); // 2 capabilities + 1 instruction
      expect(result.stats.totalWorkflows).toBe(1);
      expect(result.stats.totalFiles).toBe(5); // 3 resources + 2 nodes
    } finally {
      removeTmpDir(rootDir);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Property 10: Incremental scan consistency                          */
/* ------------------------------------------------------------------ */

describe('incremental scan consistency (Property 10)', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any incremental scan result merged with a cached full scan, the merged
   * result shall be identical to what a full scan would produce on the current
   * filesystem state. No stale entries from the cache shall persist for files
   * that have been deleted or modified.
   */
  it('incremental scan after adding a resource matches full scan', () => {
    const rootDir = createTmpDir();
    try {
      const capabilitiesDir = path.join(rootDir, '.agentflow', 'capabilities');
      fs.mkdirSync(capabilitiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(capabilitiesDir, 'existing.md'),
        '---\nname: existing\n---\n# Existing\n',
        'utf-8',
      );

      // Full scan as baseline
      const cached = scan(rootDir, 5);
      expect(cached.resources.capabilities).toHaveLength(1);

      // Add a new file
      fs.writeFileSync(
        path.join(capabilitiesDir, 'new-tool.md'),
        '---\nname: new-tool\n---\n# New Tool\n',
        'utf-8',
      );

      // Incremental scan with the changed file
      const incremental = scanIncremental(
        rootDir,
        [path.join('.agentflow', 'capabilities', 'new-tool.md')],
        cached,
      );

      // Full scan for comparison
      const full = scan(rootDir, 5);

      expect(incremental.resources.capabilities).toHaveLength(full.resources.capabilities.length);
      expect(incremental.stats.totalResources).toBe(full.stats.totalResources);
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('incremental scan after deleting a resource removes stale entry', () => {
    const rootDir = createTmpDir();
    try {
      const capabilitiesDir = path.join(rootDir, '.agentflow', 'capabilities');
      fs.mkdirSync(capabilitiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(capabilitiesDir, 'keep.md'),
        '---\nname: keep\n---\n# Keep\n',
        'utf-8',
      );
      fs.writeFileSync(
        path.join(capabilitiesDir, 'remove.md'),
        '---\nname: remove\n---\n# Remove\n',
        'utf-8',
      );

      const cached = scan(rootDir, 5);
      expect(cached.resources.capabilities).toHaveLength(2);

      // Delete the file
      fs.unlinkSync(path.join(capabilitiesDir, 'remove.md'));

      const incremental = scanIncremental(
        rootDir,
        [path.join('.agentflow', 'capabilities', 'remove.md')],
        cached,
      );

      expect(incremental.resources.capabilities).toHaveLength(1);
      expect(incremental.resources.capabilities[0].name).toBe('keep');
      expect(incremental.stats.totalResources).toBe(1);
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('incremental scan after modifying a resource updates entry', () => {
    const rootDir = createTmpDir();
    try {
      const instructionsDir = path.join(rootDir, '.agentflow', 'instructions');
      fs.mkdirSync(instructionsDir, { recursive: true });
      fs.writeFileSync(
        path.join(instructionsDir, 'my-skill.md'),
        '---\nname: old-name\n---\n# Old\n',
        'utf-8',
      );

      const cached = scan(rootDir, 5);
      expect(cached.resources.instructions[0].name).toBe('old-name');

      // Modify the file
      fs.writeFileSync(
        path.join(instructionsDir, 'my-skill.md'),
        '---\nname: new-name\n---\n# New\n',
        'utf-8',
      );

      const incremental = scanIncremental(
        rootDir,
        [path.join('.agentflow', 'instructions', 'my-skill.md')],
        cached,
      );

      expect(incremental.resources.instructions).toHaveLength(1);
      expect(incremental.resources.instructions[0].name).toBe('new-name');
    } finally {
      removeTmpDir(rootDir);
    }
  });

  it('falls back to full scan when no cached result provided', () => {
    const rootDir = createTmpDir();
    try {
      const capabilitiesDir = path.join(rootDir, '.agentflow', 'capabilities');
      fs.mkdirSync(capabilitiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(capabilitiesDir, 'tool.md'),
        '---\nname: tool\n---\n# Tool\n',
        'utf-8',
      );

      const result = scanIncremental(rootDir, ['anything'], null);
      expect(result.resources.capabilities).toHaveLength(1);
    } finally {
      removeTmpDir(rootDir);
    }
  });
});
