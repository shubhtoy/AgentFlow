'use strict';

/* ------------------------------------------------------------------ */
/*  Built-in event types                                               */
/* ------------------------------------------------------------------ */

const BUILT_IN_EVENTS = {
  'fileEdited':        { fields: ['path', 'content', 'oldContent'] },
  'fileCreated':       { fields: ['path', 'content'] },
  'fileDeleted':       { fields: ['path'] },
  'preToolUse':        { fields: ['toolName', 'args', 'source'] },
  'postToolUse':       { fields: ['toolName', 'args', 'result', 'source'] },
  'workflowStarted':  { fields: ['workflowId', 'trigger'] },
  'workflowCompleted': { fields: ['workflowId', 'result', 'duration'] },
  'workflowFailed':   { fields: ['workflowId', 'error'] },
  'nodeEntered':       { fields: ['workflowId', 'nodeId', 'nodeType'] },
  'nodeCompleted':     { fields: ['workflowId', 'nodeId', 'result'] },
  'memoryUpdated':     { fields: ['category', 'key', 'value'] },
  'protocolToggled':   { fields: ['protocolName', 'enabled'] },
};

/* ------------------------------------------------------------------ */
/*  ReDoS guard                                                        */
/* ------------------------------------------------------------------ */

const MAX_REGEX_LENGTH = 512;
const REDOS_PATTERN = /(\+|\*|\{)\1|(\.\*){3}|\(\?[^)]*\)\{/;

function isSafeRegex(pattern) {
  if (pattern.length > MAX_REGEX_LENGTH) return false;
  if (REDOS_PATTERN.test(pattern)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Condition evaluator (pure function)                                */
/* ------------------------------------------------------------------ */

function evaluateCondition(fieldValue, operator, expected) {
  if (fieldValue === undefined || fieldValue === null) return false;

  const strValue = String(fieldValue);
  const strExpected = String(expected);

  switch (operator) {
    case 'equals':     return strValue === strExpected;
    case 'contains':   return strValue.includes(strExpected);
    case 'startsWith': return strValue.startsWith(strExpected);
    case 'endsWith':   return strValue.endsWith(strExpected);
    case 'matches': {
      if (!isSafeRegex(strExpected)) return false;
      try {
        return new RegExp(strExpected).test(strValue);
      } catch {
        return false;
      }
    }
    default: return false;
  }
}

/* ------------------------------------------------------------------ */
/*  EventHookEngine                                                    */
/* ------------------------------------------------------------------ */

class EventHookEngine {
  /**
   * @param {object} hookRegistry   - has getHooksForEvent(eventName)
   * @param {object} actionExecutor - has execute(action, payload)
   * @param {object} logger         - has info(), warn(), error()
   */
  constructor(hookRegistry, actionExecutor, logger) {
    this._hookRegistry = hookRegistry;
    this._actionExecutor = actionExecutor;
    this._logger = logger;
    this._eventTypes = new Map();

    // Register built-in events
    for (const [name, schema] of Object.entries(BUILT_IN_EVENTS)) {
      this.registerEventType(name, schema);
    }
  }

  /** Emit an event — evaluates all registered hooks and fires matching ones. */
  async emit(eventName, payload) {
    if (!this._eventTypes.has(eventName)) {
      this._logger.warn(`Unknown event type: ${eventName}`);
    }
    return this.evaluateAndFireHooks(eventName, payload);
  }

  /** Register an event type with its payload schema. */
  registerEventType(name, payloadSchema) {
    this._eventTypes.set(name, payloadSchema);
  }

  /** Get all registered event types. */
  listEventTypes() {
    return [...this._eventTypes.keys()];
  }

  /** Core evaluation loop — sort by priority, evaluate conditions, fire sequentially. */
  async evaluateAndFireHooks(eventName, payload) {
    const hooks = this._hookRegistry.getHooksForEvent(eventName);
    hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    const results = [];

    for (const hook of hooks) {
      if (!hook.enabled) {
        results.push({ hookId: hook.name, fired: false, reason: 'disabled' });
        continue;
      }

      if (hook.condition) {
        const fieldValue = payload[hook.condition.field];
        const matches = evaluateCondition(fieldValue, hook.condition.operator, hook.condition.value);
        if (!matches) {
          results.push({ hookId: hook.name, fired: false, reason: 'condition-not-met' });
          continue;
        }
      }

      try {
        const result = await this._actionExecutor.execute(hook.action, payload);
        results.push({ hookId: hook.name, fired: true, result });
      } catch (error) {
        results.push({ hookId: hook.name, fired: true, error: error.message });
      }
    }

    return results;
  }
}

module.exports = { EventHookEngine, evaluateCondition, BUILT_IN_EVENTS, isSafeRegex };
