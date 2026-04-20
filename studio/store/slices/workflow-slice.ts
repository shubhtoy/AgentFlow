import { type StateCreator } from 'zustand'

export interface WorkflowSlice {
  // Core workflow state — mirrors essentials from the primary store.
  // New components should use this slice; existing ones keep using useAppStore.
  workflowData: any | null
  activeWorkflow: string
  selectedNode: string | null

  // Actions
  setWorkflowData: (data: any) => void
  setActiveWorkflow: (id: string) => void
  setSelectedNode: (id: string | null) => void
}

export const createWorkflowSlice: StateCreator<WorkflowSlice> = (set) => ({
  workflowData: null,
  activeWorkflow: '',
  selectedNode: null,

  setWorkflowData: (data) => set({ workflowData: data }),
  setActiveWorkflow: (id) => set({ activeWorkflow: id }),
  setSelectedNode: (id) => set({ selectedNode: id }),
})
