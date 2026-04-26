/* ------------------------------------------------------------------ */
/*  Built-in event types                                               */
/* ------------------------------------------------------------------ */

interface EventSchema {
  fields: string[];
}

export const BUILT_IN_EVENTS: Record<string, EventSchema> = {
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

export function isSafeRegex(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) return false;
  if (REDOS_PATTERN.test(pattern)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Condition evaluator (pure function)                                */
/* ------------------------------------------------------------------ */

type Operator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches';

export function evaluateCondition(fieldValue: unknown, operator: string, expected: unknown): boolean {
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

interface HookCondition {
  field: string;
  operator: Operator;
  value: unknown;
}

interface Hook {
  name: string;
  enabled: boolean;
  priority?: number;
  condition?: HookCondition;
  action: unknown;
}

interface HookRegistry {
  getHooksForEvent(eventName: string): Hook[];
}

interface ActionExecutor {
  execute(action: unknown, payload: Record<string, unknown>): Promise<unknown>;
}

interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface HookResult {
  hookId: string;
  fired: boolean;
  reason?: string;
  result?: unknown;
  error?: string;
}

export class EventHookEngine {
  private _hookRegistry: HookRegistry;
  private _actionExecutor: ActionExecutor;
  private _logger: Logger;
  private _eventTypes: Map<string, EventSchema>;

  constructor(hookRegistry: HookRegistry, actionExecutor: ActionExecutor, logger: Logger) {
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
  async emit(eventName: string, payload: Record<string, unknown>): Promise<HookResult[]> {
    if (!this._eventTypes.has(eventName)) {
      this._logger.warn(`Unknown event type: ${eventName}`);
    }
    return this.evaluateAndFireHooks(eventName, payload);
  }

  /** Register an event type with its payload schema. */
  registerEventType(name: string, payloadSchema: EventSchema): void {
    this._eventTypes.set(name, payloadSchema);
  }

  /** Get all registered event types. */
  listEventTypes(): string[] {
    return [...this._eventTypes.keys()];
  }

  /** Core evaluation loop — sort by priority, evaluate conditions, fire sequentially. */
  async evaluateAndFireHooks(eventName: string, payload: Record<string, unknown>): Promise<HookResult[]> {
    const hooks = this._hookRegistry.getHooksForEvent(eventName);
    hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

    const results: HookResult[] = [];

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
      } catch (error: unknown) {
        results.push({ hookId: hook.name, fired: true, error: (error as Error).message });
      }
    }

    return results;
  }
}
