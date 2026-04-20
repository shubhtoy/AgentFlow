'use strict';

const { z } = require('zod');

const patternEnum = z.enum(['single', 'supervisor', 'router', 'handoff', 'blackboard', 'pipeline']);

/** Phase 1: Intent extraction */
const IntentResponseSchema = z.object({
  purpose: z.string().min(1).max(500),
  suggestedPattern: patternEnum,
  patternReason: z.string(),
  clarifyingQuestions: z.array(z.string()).max(3),
  suggestedName: z.string().regex(/^[a-z0-9-]+$/).max(64),
});

/** Phase 2: Pattern confirmation + tool/skill selection */
const ToolSelectionResponseSchema = z.object({
  confirmedPattern: patternEnum,
  tools: z.array(z.object({
    name: z.string(),
    source: z.enum(['library', 'mcp', 'custom']),
    reason: z.string(),
  })),
  skills: z.array(z.object({
    name: z.string(),
    reason: z.string(),
  })),
  interactions: z.array(z.string()).optional(),
  memory: z.array(z.string()).optional(),
});

/** Phase 3: Node structure generation */
const NodeStructureResponseSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    nodeType: z.enum(['step', 'router', 'sub-workflow']),
    entry: z.boolean(),
    description: z.string(),
    tools: z.array(z.string()),
    skills: z.array(z.string()),
    instructions: z.string(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    condition: z.string().optional(),
  })),
  identity: z.object({
    name: z.string(),
    role: z.string(),
    constraints: z.array(z.string()),
  }),
});

/** Phase 4: Final review confirmation */
const ReviewResponseSchema = z.object({
  approved: z.boolean(),
  modifications: z.array(z.object({
    target: z.enum(['node', 'edge', 'tool', 'skill', 'identity']),
    action: z.enum(['add', 'remove', 'modify']),
    details: z.string(),
  })).optional(),
});

/** Full scaffold validation schema */
const AgentScaffoldSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/).min(1).max(64),
  description: z.string().min(1).max(500),
  identity: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    constraints: z.array(z.string()),
  }),
  pattern: patternEnum,
  tools: z.array(z.object({
    name: z.string(),
    source: z.enum(['library', 'mcp', 'custom']),
    mcpServer: z.string().optional(),
  })),
  skills: z.array(z.string()),
  interactions: z.array(z.string()).optional(),
  memory: z.array(z.string()).optional(),
  nodes: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string(),
    nodeType: z.enum(['step', 'router', 'sub-workflow']),
    entry: z.boolean(),
    description: z.string(),
    tools: z.array(z.string()),
    skills: z.array(z.string()),
    instructions: z.string().min(1),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    condition: z.string().optional(),
  })),
  metadata: z.object({
    createdVia: z.enum(['chat', 'template', 'manual']),
    templateId: z.string().optional(),
    conversationId: z.string().optional(),
  }).optional(),
});

/** Map phase name to its Zod schema */
const PHASE_SCHEMAS = {
  intent: IntentResponseSchema,
  pattern: ToolSelectionResponseSchema,
  tools: ToolSelectionResponseSchema,
  nodes: NodeStructureResponseSchema,
  review: ReviewResponseSchema,
};

module.exports = {
  IntentResponseSchema,
  ToolSelectionResponseSchema,
  NodeStructureResponseSchema,
  ReviewResponseSchema,
  AgentScaffoldSchema,
  PHASE_SCHEMAS,
};
