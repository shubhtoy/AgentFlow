import { type StateCreator } from 'zustand'

export interface ExecutionSlice {
  nodeStatuses: Record<string, { state: string; startedAt?: string }>
  approvalQueue: any[]
  setNodeStatus: (nodeId: string, status: { state: string; startedAt?: string }) => void
  approveItem: (id: string) => void
  rejectItem: (id: string) => void
}

export const createExecutionSlice: StateCreator<ExecutionSlice> = (set) => ({
  nodeStatuses: {},
  approvalQueue: [],
  setNodeStatus: (nodeId, status) =>
    set((s) => ({ nodeStatuses: { ...s.nodeStatuses, [nodeId]: status } })),
  approveItem: (id) =>
    set((s) => ({ approvalQueue: s.approvalQueue.filter((item) => item.id !== id) })),
  rejectItem: (id) =>
    set((s) => ({ approvalQueue: s.approvalQueue.filter((item) => item.id !== id) })),
})
