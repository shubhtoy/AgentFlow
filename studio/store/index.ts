// Backward compatible — existing components keep using useAppStore
export { useAppStore, StoreProvider } from '../store'

// New sliced store — new components use this
export { useNewStore } from './create-store'
export type { NewAppStore } from './create-store'

// Re-export slice types for consumers
export type { WorkflowSlice } from './slices/workflow-slice'
export type { UISlice } from './slices/ui-slice'
export type { ValidationSlice } from './slices/validation-slice'
export type { ExecutionSlice } from './slices/execution-slice'
export type { LibrarySlice } from './slices/library-slice'
