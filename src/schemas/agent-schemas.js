'use strict';

const { z } = require('zod');

/** Provider config validation */
const agentConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  model: z.string().optional(),
  apiKey: z.string().min(1, 'API key is required'),
});

/** Chat request validation */
const agentChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.string(),
    toolCalls: z.array(z.any()).optional(),
  })).min(1),
  provider: z.enum(['anthropic', 'openai']),
  model: z.string().optional(),
  apiKey: z.string().min(1),
  workflowId: z.string().optional(),
});

/** SSE event types (for documentation, not runtime validation) */
const SSE_EVENT_TYPES = ['text_delta', 'tool_call', 'tool_result', 'error', 'done'];

module.exports = {
  agentConfigSchema,
  agentChatSchema,
  SSE_EVENT_TYPES,
};
