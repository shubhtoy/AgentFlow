/**
 * Brand Schemas — Zod schema for brand/white-label configuration.
 */

import { z } from 'zod'

export const brandConfigSchema = z.object({
  name: z.string().min(1).max(64).default('AgentFlow'),
  dir: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .default('.agentflow'),
  cli: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9-]+$/)
    .default('agentflow'),
  logo: z.string().optional(),
  theme: z.string().optional(),
})

export type BrandConfig = z.infer<typeof brandConfigSchema>
