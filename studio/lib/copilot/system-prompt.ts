/**
 * System prompt — now built dynamically per session in agent.ts.
 * This file kept for backward compatibility only.
 * @deprecated Import buildSystemPrompt from agent.ts instead.
 */

import { ctx } from '@/lib/runtime'

// Static export for anything that still imports SYSTEM_PROMPT directly
export const SYSTEM_PROMPT = `You are Flow — the AI assistant for AgentFlow Studio.
Workspace: ${ctx().workspaceRoot}
Mode: ${ctx().mode}
`
