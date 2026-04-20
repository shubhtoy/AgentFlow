import { describe, it, expect } from 'vitest';
const { HookAbstractionLayer, HOOK_EVENT_MAP, HOOK_ACTION_MAP } = require('../../packages/core/src/transport/hook-abstraction-layer.js');

const hal = new HookAbstractionLayer();

const mkHook = (event, actionType = 'command', target = 'echo hi') => ({
  name: 'test-hook',
  event,
  action: { type: actionType, target },
  condition: null,
  enabled: true,
  description: 'test',
});

describe('HookAbstractionLayer', () => {
  describe('Event mapping per platform', () => {
    it('kiro: translates canonical events to kiro format', () => {
      const cases = { FileEdited: 'fileEdited', PreToolUse: 'preToolUse', Stop: 'agentStop', UserPromptSubmit: 'promptSubmit' };
      for (const [canonical, expected] of Object.entries(cases)) {
        const { hooks } = hal.translateForExport([mkHook(canonical)], 'kiro');
        expect(hooks[0].event).toBe(expected);
      }
    });

    it('claude-code: events stay PascalCase', () => {
      for (const ev of ['PreToolUse', 'Stop', 'SubagentStart']) {
        const { hooks } = hal.translateForExport([mkHook(ev)], 'claude-code');
        expect(hooks[0].event).toBe(ev);
      }
    });

    it('vscode-copilot: same mapping as claude-code', () => {
      for (const ev of ['PreToolUse', 'Stop', 'SubagentStart']) {
        const { hooks } = hal.translateForExport([mkHook(ev)], 'vscode-copilot');
        expect(hooks[0].event).toBe(ev);
      }
    });

    it('cursor/windsurf: passthrough — event unchanged', () => {
      for (const p of ['cursor', 'windsurf']) {
        const { hooks } = hal.translateForExport([mkHook('FileEdited')], p);
        expect(hooks[0].event).toBe('FileEdited');
      }
    });
  });

  describe('Action mapping per platform', () => {
    it('kiro: command→runCommand, prompt→askAgent', () => {
      expect(hal.translateForExport([mkHook('Stop', 'command')], 'kiro').hooks[0].action.type).toBe('runCommand');
      expect(hal.translateForExport([mkHook('Stop', 'prompt')], 'kiro').hooks[0].action.type).toBe('askAgent');
    });

    it('claude-code: action types unchanged', () => {
      expect(hal.translateForExport([mkHook('Stop', 'command')], 'claude-code').hooks[0].action.type).toBe('command');
      expect(hal.translateForExport([mkHook('Stop', 'prompt')], 'claude-code').hooks[0].action.type).toBe('prompt');
    });

    it('cursor/windsurf: passthrough — action type unchanged', () => {
      for (const p of ['cursor', 'windsurf']) {
        expect(hal.translateForExport([mkHook('Stop', 'command')], p).hooks[0].action.type).toBe('command');
      }
    });
  });

  describe('translateForExport — zero-drop guarantee', () => {
    it('output count === input count for every platform', () => {
      const hooks = [mkHook('PreToolUse'), mkHook('Stop'), mkHook('FileEdited')];
      for (const p of ['kiro', 'claude-code', 'vscode-copilot', 'cursor', 'windsurf']) {
        expect(hal.translateForExport(hooks, p).hooks).toHaveLength(hooks.length);
      }
    });
  });

  describe('translateForExport — untranslatable event warning', () => {
    it('warns when event has no mapping but still includes the hook', () => {
      const { hooks, warnings } = hal.translateForExport([mkHook('FileEdited')], 'claude-code');
      expect(hooks).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/FileEdited/);
      expect(warnings[0]).toMatch(/no native mapping/);
    });
  });

  describe('translateForImport — _platformExtensions preserved', () => {
    it('extra fields on platform hooks land in _platformExtensions', () => {
      const platformHook = { ...mkHook('preToolUse'), customField: 'xyz', priority: 5 };
      const { hooks } = hal.translateForImport([platformHook], 'kiro');
      expect(hooks[0]._platformExtensions).toEqual({ customField: 'xyz', priority: 5 });
    });
  });

  describe('Round-trip fidelity', () => {
    for (const p of ['kiro', 'claude-code', 'vscode-copilot']) {
      it(`${p}: export→import preserves event, action type, and target`, () => {
        const original = mkHook('PreToolUse', 'command', 'lint .');
        const { hooks: exported } = hal.translateForExport([original], p);
        const { hooks: imported } = hal.translateForImport(exported, p);
        expect(imported[0].event).toBe(original.event);
        expect(imported[0].action.type).toBe(original.action.type);
        expect(imported[0].action.target).toBe(original.action.target);
      });
    }
  });

  describe('Passthrough platforms', () => {
    for (const p of ['cursor', 'windsurf']) {
      it(`${p}: export and import leave hooks unchanged`, () => {
        const original = mkHook('CustomEvent', 'customAction', '/run thing');
        const { hooks: exported } = hal.translateForExport([original], p);
        expect(exported[0].event).toBe('CustomEvent');
        expect(exported[0].action.type).toBe('customAction');
        expect(exported[0].action.target).toBe('/run thing');

        const { hooks: imported } = hal.translateForImport(exported, p);
        expect(imported[0].event).toBe('CustomEvent');
        expect(imported[0].action.type).toBe('customAction');
        expect(imported[0].action.target).toBe('/run thing');
      });
    }
  });
});
