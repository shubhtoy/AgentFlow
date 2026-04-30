import { describe, it, expect } from 'vitest';
import path from 'path';

// TODO: src/orchestrator.js archived — orchestrator is dead (decisions.md Phase 2)
describe.skip('orchestrator (archived)', () => {})

/*
import { assembleContext, buildToolEntry, buildNodeTools, BUILTIN_EXECUTORS, runWithTools, } from '../../packages/cli/src/orchestrator';
import { parseRoot } from '../../packages/cli/src/parser';

const EXAMPLES_DIR = path.join(__dirname, '../../examples/.agentflow');

describe('orchestrator', () => {
  describe('assembleContext', () => {
    it('includes workspace identity in assembled context', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['gather-requirements'];
      const state = { outputs: {} };

      const ctx = assembleContext(node, workflow, graph, state);

      expect(ctx).toContain('Senior Engineer');
      expect(ctx).toContain('Never skip tests');
    });

    it('includes node primary content', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['gather-requirements'];
      const state = { outputs: {} };

      const ctx = assembleContext(node, workflow, graph, state);

      expect(ctx).toContain('Gather Requirements');
      expect(ctx).toContain('requirements-analyst');
    });

    it('resolves mention refs (skills, memory) but NOT tools', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['gather-requirements'];
      const state = { outputs: {} };

      const ctx = assembleContext(node, workflow, graph, state);

      // Skills should be resolved into context
      expect(ctx).toContain('requirements-elicitation');
      // Tools should NOT be in context (they're wired as callable tools)
      expect(ctx).not.toContain('--- Resolved: tools/read-code ---');
    });

    it('injects prior node outputs for data_flow refs', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['review-requirements-gate'];
      const state = {
        outputs: {
          'gather-requirements': 'Here are the requirements I gathered...',
        },
      };

      const ctx = assembleContext(node, workflow, graph, state);

      expect(ctx).toContain('Here are the requirements I gathered...');
      expect(ctx).toContain('Output from gather-requirements');
    });

    it('handles router nodes without crashing', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['task-completion-gate'];
      const state = { outputs: {} };

      const ctx = assembleContext(node, workflow, graph, state);

      expect(ctx).toContain('Task Completion Gate');
    });
  });

  describe('buildNodeTools', () => {
    it('builds tool schemas from node refs', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['gather-requirements'];

      const toolMap = buildNodeTools(node, graph);

      // gather-requirements references read-code, write-file, source-agent
      expect(toolMap['read-code']).toBeDefined();
      expect(toolMap['write-file']).toBeDefined();
      expect(toolMap['source-agent']).toBeDefined();
    });

    it('includes tools from frontmatter context.inputs', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['create-design'];

      const toolMap = buildNodeTools(node, graph);

      // create-design has tools in frontmatter context.inputs
      expect(toolMap['read-code']).toBeDefined();
      expect(toolMap['write-file']).toBeDefined();
      expect(toolMap['source-agent']).toBeDefined();
    });

    it('produces valid Anthropic tool schemas', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['gather-requirements'];

      const toolMap = buildNodeTools(node, graph);
      const readCode = toolMap['read-code'];

      expect(readCode.schema).toBeDefined();
      expect(readCode.schema.name).toBe('read-code');
      expect(readCode.schema.input_schema.type).toBe('object');
      expect(readCode.schema.input_schema.properties.path).toBeDefined();
      expect(readCode.executor).toBeTypeOf('function');
    });

    it('returns empty map for nodes with no tool refs', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['task-completion-gate'];

      const toolMap = buildNodeTools(node, graph);

      // task-completion-gate has no tool refs (only condition templates)
      expect(Object.keys(toolMap).length).toBe(0);
    });

    it('builds script-type tools with command', () => {
      const graph = parseRoot(EXAMPLES_DIR);
      const workflow = graph.workflows['build-feature'];
      const node = workflow.nodes['implement-task'];

      const toolMap = buildNodeTools(node, graph);

      const runTests = toolMap['run-tests'];
      expect(runTests).toBeDefined();
      expect(runTests.toolType).toBe('script');
    });
  });

  describe('BUILTIN_EXECUTORS', () => {
    it('readCode reads a file', () => {
      const result = BUILTIN_EXECUTORS.readCode(
        { path: 'package.json' },
        { workingDir: path.join(__dirname, '../..') },
      );

      expect(result.content).toContain('agentflow');
      expect(result.lines).toBeGreaterThan(0);
    });

    it('readCode returns error for missing file', () => {
      const result = BUILTIN_EXECUTORS.readCode(
        { path: 'nonexistent.txt' },
        { workingDir: path.join(__dirname, '../..') },
      );

      expect(result.error).toContain('not found');
    });

    it('readCode lists directory contents', () => {
      const result = BUILTIN_EXECUTORS.readCode(
        { path: 'src' },
        { workingDir: path.join(__dirname, '../..') },
      );

      expect(result.type).toBe('directory');
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('readCode searches for symbols', () => {
      const result = BUILTIN_EXECUTORS.readCode(
        { path: 'src/parser.js', symbol: 'parseRoot' },
        { workingDir: path.join(__dirname, '../..') },
      );

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].text).toContain('parseRoot');
    });

    it('fsWrite creates a file and cleans up', () => {
      const tmpPath = `tests/unit/_tmp_test_${Date.now()}.txt`;
      const fullPath = path.join(__dirname, '../..', tmpPath);

      try {
        const result = BUILTIN_EXECUTORS.fsWrite(
          { path: tmpPath, content: 'hello world' },
          { workingDir: path.join(__dirname, '../..') },
        );

        expect(result.success).toBe(true);
        import fs from 'fs';
        expect(fs.readFileSync(fullPath, 'utf-8')).toBe('hello world');
      } finally {
        import fs from 'fs';
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    });

    it('getDiagnostics checks a JS file', () => {
      const result = BUILTIN_EXECUTORS.getDiagnostics(
        { paths: ['src/parser.js'] },
        { workingDir: path.join(__dirname, '../..') },
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].ok).toBe(true);
    });
  });

  describe('runWithTools — usage tracking', () => {
    const noop = () => {};

    it('returns { text, usage } with accumulated usage from a single LLM call', async () => {
      const fakeLLM = async () => ({
        text: 'Hello',
        toolCalls: [],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await runWithTools(
        [{ role: 'user', content: 'hi' }],
        {},
        fakeLLM,
        {},
        noop,
      );

      expect(result).toHaveProperty('text', 'Hello');
      expect(result).toHaveProperty('usage');
      expect(result.usage.input_tokens).toBe(100);
      expect(result.usage.output_tokens).toBe(50);
    });

    it('accumulates usage across multiple tool rounds', async () => {
      let callCount = 0;
      const fakeLLM = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: '',
            toolCalls: [{ id: 'tc1', name: 'my-tool', input: {} }],
            stopReason: 'tool_use',
            usage: { input_tokens: 200, output_tokens: 30 },
          };
        }
        return {
          text: 'Done',
          toolCalls: [],
          stopReason: 'end_turn',
          usage: { input_tokens: 150, output_tokens: 80 },
        };
      };

      const toolMap = {
        'my-tool': {
          schema: { name: 'my-tool', description: 'test', input_schema: { type: 'object', properties: {} } },
          executor: () => ({ ok: true }),
        },
      };

      const result = await runWithTools(
        [{ role: 'user', content: 'do stuff' }],
        toolMap,
        fakeLLM,
        { provider: 'openai' },
        noop,
      );

      expect(result.text).toBe('Done');
      expect(result.usage.input_tokens).toBe(350);  // 200 + 150
      expect(result.usage.output_tokens).toBe(110);  // 30 + 80
    });

    it('returns zero usage when LLM provides no usage data', async () => {
      const fakeLLM = async () => ({
        text: 'No usage',
        toolCalls: [],
        stopReason: 'end_turn',
      });

      const result = await runWithTools(
        [{ role: 'user', content: 'hi' }],
        {},
        fakeLLM,
        {},
        noop,
      );

      expect(result.text).toBe('No usage');
      expect(result.usage.input_tokens).toBe(0);
      expect(result.usage.output_tokens).toBe(0);
    });

    it('returns usage even when max tool rounds is reached', async () => {
      const fakeLLM = async () => ({
        text: '',
        toolCalls: [{ id: 'tc1', name: 'loop-tool', input: {} }],
        stopReason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const toolMap = {
        'loop-tool': {
          schema: { name: 'loop-tool', description: 'test', input_schema: { type: 'object', properties: {} } },
          executor: () => ({ ok: true }),
        },
      };

      const result = await runWithTools(
        [{ role: 'user', content: 'loop' }],
        toolMap,
        fakeLLM,
        { maxToolRounds: 3, provider: 'openai' },
        noop,
      );

      expect(result.text).toBe('[Max tool rounds reached]');
      expect(result.usage.input_tokens).toBe(30);  // 10 * 3
      expect(result.usage.output_tokens).toBe(15);  // 5 * 3
    });
  });
});

*/
