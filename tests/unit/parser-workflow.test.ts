import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseWorkflow } from '../../packages/cli/src/parser';

/**
 * Helper: create a temp directory with a given file tree.
 * tree is an object where keys are relative paths and values are file contents.
 */
function createTempTree(tree) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentflow-test-'));
  for (const [relPath, content] of Object.entries(tree)) {
    const fullPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
  return tmpDir;
}

/** Helper: clean up temp directory */
function removeTempTree(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('parseWorkflow', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) removeTempTree(tmpDir);
  });

  it('parses a simple workflow with two nodes and an edge', () => {
    tmpDir = createTempTree({
      'nodeA/main.md': '# Node A\n\nGo to {{-> nodeB}}',
      'nodeB/main.md': '# Node B\n\nDone.',
    });

    const wf = parseWorkflow(tmpDir);

    expect(Object.keys(wf.nodes)).toHaveLength(2);
    expect(wf.nodes['nodeA']).toBeDefined();
    expect(wf.nodes['nodeB']).toBeDefined();
    expect(wf.edges).toHaveLength(1);
    expect(wf.edges[0].from).toBe('nodeA');
    expect(wf.edges[0].to).toBe('nodeB');
    expect(wf.edges[0].condition).toBeUndefined();
  });

  it('detects descriptor file with type: agents frontmatter', () => {
    tmpDir = createTempTree({
      'workflow.md': '---\ntype: agents\nname: My Workflow\ndescription: A test workflow\n---\n# Workflow',
      'step1/main.md': '# Step 1',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.descriptorFile).toBeDefined();
    expect(wf.descriptorFile.frontmatter.type).toBe('agents');
    expect(wf.name).toBe('My Workflow');
    expect(wf.description).toBe('A test workflow');
  });

  it('detects AGENTS.md as descriptor file by convention', () => {
    tmpDir = createTempTree({
      'AGENTS.md': '# My Agent Workflow',
      'step1/main.md': '# Step 1',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.descriptorFile).toBeDefined();
    expect(wf.name).toBe('My Agent Workflow');
  });

  it('skips reserved directories (instructions, capabilities, etc.)', () => {
    tmpDir = createTempTree({
      'capabilities/hammer.md': '---\nname: Hammer\n---\n# Hammer Tool',
      'instructions/debug.md': '# Debug Skill',
      'nodeA/main.md': '# Node A',
    });

    const wf = parseWorkflow(tmpDir);

    expect(Object.keys(wf.nodes)).toHaveLength(1);
    expect(wf.nodes['nodeA']).toBeDefined();
    expect(wf.nodes['capabilities']).toBeUndefined();
    expect(wf.nodes['instructions']).toBeUndefined();
  });

  it('skips directories without .md files', () => {
    tmpDir = createTempTree({
      'nodeA/main.md': '# Node A',
      'empty-dir/.gitkeep': '',
      'data/config.json': '{}',
    });

    const wf = parseWorkflow(tmpDir);

    expect(Object.keys(wf.nodes)).toHaveLength(1);
    expect(wf.nodes['nodeA']).toBeDefined();
  });

  it('detects explicit entry points from frontmatter entry: true', () => {
    tmpDir = createTempTree({
      'start/main.md': '---\nentry: true\n---\n# Start\n\n{{-> middle}}',
      'middle/main.md': '# Middle\n\n{{-> end}}',
      'end/main.md': '# End',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.entryPoints).toEqual(['start']);
    expect(wf.nodes['start'].entry).toBe(true);
    expect(wf.nodes['start'].entryInferred).toBe(false);
  });

  it('infers entry points from nodes with no incoming edges', () => {
    tmpDir = createTempTree({
      'nodeA/main.md': '# Node A\n\n{{-> nodeB}}',
      'nodeB/main.md': '# Node B',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.entryPoints).toEqual(['nodeA']);
    expect(wf.nodes['nodeA'].entryInferred).toBe(true);
    expect(wf.nodes['nodeB'].entryInferred).toBe(false);
  });

  it('marks multiple inferred entry points when no explicit entries exist', () => {
    tmpDir = createTempTree({
      'nodeA/main.md': '# Node A',
      'nodeB/main.md': '# Node B',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.entryPoints).toHaveLength(2);
    expect(wf.entryPoints).toContain('nodeA');
    expect(wf.entryPoints).toContain('nodeB');
    expect(wf.nodes['nodeA'].entryInferred).toBe(true);
    expect(wf.nodes['nodeB'].entryInferred).toBe(true);
  });

  it('builds conditional edges with condition field', () => {
    tmpDir = createTempTree({
      'router/main.md': '---\ntype: router\n---\n# Router\n\n{{-> yes | templates/is-positive}}\n{{-> no | templates/is-negative}}',
      'yes/main.md': '# Yes Path',
      'no/main.md': '# No Path',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.edges).toHaveLength(2);
    const yesEdge = wf.edges.find((e) => e.to === 'yes');
    const noEdge = wf.edges.find((e) => e.to === 'no');
    expect(yesEdge).toBeDefined();
    expect(yesEdge.condition).toBe('templates/is-positive');
    expect(noEdge).toBeDefined();
    expect(noEdge.condition).toBe('templates/is-negative');
  });

  it('recursively parses sub-workflow nodes', () => {
    tmpDir = createTempTree({
      'outer/main.md': '---\ntype: sub-workflow\n---\n# Outer',
      'outer/AGENTS.md': '---\ntype: agents\nname: Inner Workflow\n---\n# Inner',
      'outer/inner-step/main.md': '# Inner Step',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.nodes['outer']).toBeDefined();
    expect(wf.nodes['outer'].nodeType).toBe('sub-workflow');
    expect(wf.nodes['outer'].subWorkflow).toBeDefined();
    expect(wf.nodes['outer'].subWorkflow.name).toBe('Inner Workflow');
    expect(Object.keys(wf.nodes['outer'].subWorkflow.nodes)).toContain('inner-step');
  });

  it('uses directory basename as workflow id', () => {
    tmpDir = createTempTree({
      'step1/main.md': '# Step 1',
    });

    const wf = parseWorkflow(tmpDir);

    expect(wf.id).toBe(path.basename(tmpDir));
  });

  it('returns empty edges and nodes for an empty workflow directory', () => {
    tmpDir = createTempTree({
      '.gitkeep': '',
    });

    const wf = parseWorkflow(tmpDir);

    expect(Object.keys(wf.nodes)).toHaveLength(0);
    expect(wf.edges).toHaveLength(0);
    expect(wf.entryPoints).toHaveLength(0);
  });

  it('passes mode through to parseNode for metadata-only', () => {
    tmpDir = createTempTree({
      'step1/main.md': '---\nname: Step One\n---\n# Step 1\n\nSome content with {{-> step2}}',
      'step2/main.md': '# Step 2',
    });

    const wf = parseWorkflow(tmpDir, 'metadata-only');

    // In metadata-only mode, refs are not extracted, so no edges
    expect(wf.nodes['step1']).toBeDefined();
    expect(wf.nodes['step1'].name).toBe('Step One');
  });
});
