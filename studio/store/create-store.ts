import { create } from 'zustand'
import { createWorkflowSlice, type WorkflowSlice } from './slices/workflow-slice'
import { createUISlice, type UISlice } from './slices/ui-slice'
import { createValidationSlice, type ValidationSlice } from './slices/validation-slice'
import { createExecutionSlice, type ExecutionSlice } from './slices/execution-slice'
import { createLibrarySlice, type LibrarySlice } from './slices/library-slice'
import { createAgentSlice, type AgentSlice } from './slices/agent-slice'

export type NewAppStore = WorkflowSlice & UISlice & ValidationSlice & ExecutionSlice & LibrarySlice & AgentSlice

export const useNewStore = create<NewAppStore>()((...a) => ({
  ...createWorkflowSlice(...a),
  ...createUISlice(...a),
  ...createValidationSlice(...a),
  ...createExecutionSlice(...a),
  ...createLibrarySlice(...a),
  ...createAgentSlice(...a),
}))
