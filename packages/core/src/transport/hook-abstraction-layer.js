'use strict';

/**
 * HookAbstractionLayer — single class with mapping tables for
 * cross-platform hook translation. No per-platform subclasses.
 */

// Canonical format uses PascalCase events and command/prompt action types

const HOOK_EVENT_MAP = {
  // canonical → platform-specific
  kiro: {
    PreToolUse: 'preToolUse',
    PostToolUse: 'postToolUse',
    Stop: 'agentStop',
    UserPromptSubmit: 'promptSubmit',
    FileEdited: 'fileEdited',
    FileCreated: 'fileCreated',
    FileDeleted: 'fileDeleted',
  },
  'claude-code': {
    PreToolUse: 'PreToolUse',
    PostToolUse: 'PostToolUse',
    Stop: 'Stop',
    UserPromptSubmit: 'UserPromptSubmit',
    PreCompact: 'PreCompact',
    SubagentStart: 'SubagentStart',
    SubagentStop: 'SubagentStop',
  },
  'vscode-copilot': {
    PreToolUse: 'PreToolUse',
    PostToolUse: 'PostToolUse',
    Stop: 'Stop',
    UserPromptSubmit: 'UserPromptSubmit',
    PreCompact: 'PreCompact',
    SubagentStart: 'SubagentStart',
    SubagentStop: 'SubagentStop',
  },
  // Cursor and Windsurf: passthrough (no native hook support)
  cursor: null,
  windsurf: null,
};

const HOOK_ACTION_MAP = {
  kiro: { command: 'runCommand', prompt: 'askAgent' },
  'claude-code': { command: 'command', prompt: 'prompt' },
  'vscode-copilot': { command: 'command', prompt: 'prompt' },
  cursor: null,
  windsurf: null,
};

// Reverse maps (platform → canonical) built dynamically
function buildReverseMap(map) {
  const reverse = {};
  for (const [platform, mapping] of Object.entries(map)) {
    if (!mapping) continue;
    reverse[platform] = {};
    for (const [canonical, platformVal] of Object.entries(mapping)) {
      reverse[platform][platformVal] = canonical;
    }
  }
  return reverse;
}

const REVERSE_EVENT_MAP = buildReverseMap(HOOK_EVENT_MAP);
const REVERSE_ACTION_MAP = buildReverseMap(HOOK_ACTION_MAP);

class HookAbstractionLayer {
  /**
   * Convert an AgentFlow hook to canonical format.
   */
  toCanonical(hook) {
    return {
      name: hook.name || 'unnamed',
      event: hook.event || 'unknown',
      action: {
        type: hook.action?.type || 'command',
        target: hook.action?.target || '',
      },
      condition: hook.condition || null,
      enabled: hook.enabled !== false,
      description: hook.description || '',
    };
  }

  /**
   * Convert a canonical hook to a specific platform format.
   */
  fromCanonical(canonical, platform) {
    const eventMap = HOOK_EVENT_MAP[platform];
    const actionMap = HOOK_ACTION_MAP[platform];

    // Passthrough platforms (cursor, windsurf)
    if (!eventMap) {
      return {
        name: canonical.name,
        event: canonical.event,
        action: canonical.action,
        condition: canonical.condition,
        enabled: canonical.enabled,
        description: canonical.description,
      };
    }

    const platformEvent = eventMap[canonical.event] || canonical.event;
    const platformActionType = actionMap ? (actionMap[canonical.action.type] || canonical.action.type) : canonical.action.type;

    return {
      name: canonical.name,
      event: platformEvent,
      action: { type: platformActionType, target: canonical.action.target },
      condition: canonical.condition,
      enabled: canonical.enabled,
      description: canonical.description,
    };
  }

  /**
   * Convert a platform hook to canonical format.
   */
  fromPlatform(hook, platform) {
    const reverseEvents = REVERSE_EVENT_MAP[platform];
    const reverseActions = REVERSE_ACTION_MAP[platform];

    const canonicalEvent = reverseEvents ? (reverseEvents[hook.event] || hook.event) : hook.event;
    const canonicalActionType = reverseActions ? (reverseActions[hook.action?.type] || hook.action?.type) : (hook.action?.type || 'command');

    const canonical = {
      name: hook.name || 'unnamed',
      event: canonicalEvent,
      action: { type: canonicalActionType, target: hook.action?.target || '' },
      condition: hook.condition || null,
      enabled: hook.enabled !== false,
      description: hook.description || '',
    };

    // Preserve platform-specific fields
    const knownKeys = new Set(['name', 'event', 'action', 'condition', 'enabled', 'description']);
    const extensions = {};
    for (const [k, v] of Object.entries(hook)) {
      if (!knownKeys.has(k)) extensions[k] = v;
    }
    if (Object.keys(extensions).length > 0) {
      canonical._platformExtensions = extensions;
    }

    return canonical;
  }

  /**
   * Translate hooks for export. Zero silent drops.
   * Returns { hooks: [...], warnings: [...] }
   */
  translateForExport(hooks, platform) {
    const result = [];
    const warnings = [];

    for (const hook of hooks) {
      const canonical = this.toCanonical(hook);
      const eventMap = HOOK_EVENT_MAP[platform];

      // Warn if event is untranslatable but still include it
      if (eventMap && !eventMap[canonical.event]) {
        warnings.push(`Hook "${canonical.name}": event "${canonical.event}" has no native mapping on ${platform} — preserved as-is`);
      }

      result.push(this.fromCanonical(canonical, platform));
    }

    return { hooks: result, warnings };
  }

  /**
   * Translate hooks for import. Preserves _platformExtensions.
   * Returns { hooks: [...], warnings: [...] }
   */
  translateForImport(hooks, platform) {
    const result = [];
    const warnings = [];

    for (const hook of hooks) {
      const canonical = this.fromPlatform(hook, platform);
      // Convert canonical back to AgentFlow format
      const agentflow = {
        name: canonical.name,
        event: canonical.event,
        action: canonical.action,
        condition: canonical.condition,
        enabled: canonical.enabled,
        description: canonical.description,
      };
      if (canonical._platformExtensions) {
        agentflow._platformExtensions = canonical._platformExtensions;
      }
      result.push(agentflow);
    }

    return { hooks: result, warnings };
  }
}

module.exports = { HookAbstractionLayer, HOOK_EVENT_MAP, HOOK_ACTION_MAP };
