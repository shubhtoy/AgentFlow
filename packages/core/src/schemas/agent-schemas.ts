/**
 * Agent Schemas — Zod schemas for agent config and chat requests.
 */

import { z } from 'zod'

/** Provider config validation */
export const agentConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  model: z.string().optional(),
  apiKey: z.string().min(1, 'API key is required'),
})

/** Chat request validation */
export const agentChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.string(),
    toolCalls: z.array(z.any()).optional(),
  })).min(1),
  provider: z.enum(['anthropic', 'openai']),
  model: z.string().optional(),
  apiKey: z.string().min(1),
  workflowId: z.string().optional(),
})

/** SSE event types (for documentation, not runtime validation) */
export const SSE_EVENT_TYPES = ['text_delta', 'tool_call', 'tool_result', 'error', 'done'] as const

export type AgentConfig = z.infer<typeof agentConfigSchema>
export type AgentChat = z.infer<typeof agentChatSchema>
export type SSEEventType = typeof SSE_EVENT_TYPES[number]
