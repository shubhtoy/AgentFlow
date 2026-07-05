/**
 * Builder Schemas — Zod schemas for the builder wizard phases.
 *
 * nodeType enum: step | sub-workflow.
 */

import { z } from 'zod'

const patternEnum = z.enum(['single', 'supervisor', 'router', 'handoff', 'blackboard', 'pipeline'])

/** Phase 1: Intent extraction */
export const IntentResponseSchema = z.object({
  purpose: z.string().min(1).max(500),
  suggestedPattern: patternEnum,
  patternReason: z.string(),
  clarifyingQuestions: z.array(z.string()).max(3),
  suggestedName: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(64),
})

/** Phase 2: Pattern confirmation + tool/skill selection */
export const ToolSelectionResponseSchema = z.object({
  confirmedPattern: patternEnum,
  tools: z.array(
    z.object({
      name: z.string(),
      source: z.enum(['library', 'mcp', 'custom']),
      reason: z.string(),
    }),
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
  memory: z.array(z.string()).optional(),
})

/** Phase 3: Node structure generation */
export const NodeStructureResponseSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string(),
      nodeType: z.enum(['step', 'sub-workflow']),
      entry: z.boolean(),
      description: z.string(),
      tools: z.array(z.string()),
      skills: z.array(z.string()),
      instructions: z.string(),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      condition: z.string().optional(),
    }),
  ),
  identity: z.object({
    name: z.string(),
    role: z.string(),
    constraints: z.array(z.string()),
  }),
})

/** Phase 4: Final review confirmation */
export const ReviewResponseSchema = z.object({
  approved: z.boolean(),
  modifications: z
    .array(
      z.object({
        target: z.enum(['node', 'edge', 'tool', 'skill', 'identity']),
        action: z.enum(['add', 'remove', 'modify']),
        details: z.string(),
      }),
    )
    .optional(),
})

/** Full scaffold validation schema */
export const AgentScaffoldSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(1)
    .max(64),
  description: z.string().min(1).max(500),
  identity: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    constraints: z.array(z.string()),
  }),
  pattern: patternEnum,
  tools: z.array(
    z.object({
      name: z.string(),
      source: z.enum(['library', 'mcp', 'custom']),
      mcpServer: z.string().optional(),
    }),
  ),
  skills: z.array(z.string()),
  memory: z.array(z.string()).optional(),
  nodes: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string(),
      nodeType: z.enum(['step', 'sub-workflow']),
      entry: z.boolean(),
      description: z.string(),
      tools: z.array(z.string()),
      skills: z.array(z.string()),
      instructions: z.string().min(1),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      condition: z.string().optional(),
    }),
  ),
  metadata: z
    .object({
      createdVia: z.enum(['chat', 'template', 'manual']),
      templateId: z.string().optional(),
      conversationId: z.string().optional(),
    })
    .optional(),
})

/** Map phase name to its Zod schema */
export const PHASE_SCHEMAS = {
  intent: IntentResponseSchema,
  pattern: ToolSelectionResponseSchema,
  tools: ToolSelectionResponseSchema,
  nodes: NodeStructureResponseSchema,
  review: ReviewResponseSchema,
} as const

export type IntentResponse = z.infer<typeof IntentResponseSchema>
export type ToolSelectionResponse = z.infer<typeof ToolSelectionResponseSchema>
export type NodeStructureResponse = z.infer<typeof NodeStructureResponseSchema>
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>
export type AgentScaffold = z.infer<typeof AgentScaffoldSchema>
