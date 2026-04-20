import { describe, it, expect, beforeEach } from 'vitest'
import { createUISlice, type UISlice } from '../slices/ui-slice'
import { createValidationSlice, type ValidationSlice } from '../slices/validation-slice'
import { createExecutionSlice, type ExecutionSlice } from '../slices/execution-slice'
import { createLibrarySlice, type LibrarySlice } from '../slices/library-slice'

// Minimal Zustand-compatible helpers to test slices in isolation
function createMockStore<T extends object>(creator: any): { getState: () => T; setState: (partial: Partial<T>) => void } {
  let state: T
  const set = (partial: Partial<T> | ((s: T) => Partial<T>)) => {
    const update = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...update }
  }
  const get = () => state
  state = creator(set, get, { setState: set, getState: get, subscribe: () => () => {} })
  return { getState: () => state, setState: (p) => set(p) }
}

describe('UISlice', () => {
  let store: ReturnType<typeof createMockStore<UISlice>>

  beforeEach(() => {
    store = createMockStore<UISlice>(createUISlice)
  })

  it('toggleLeftPanel toggles collapsed state', () => {
    expect(store.getState().leftPanelCollapsed).toBe(false)
    store.getState().toggleLeftPanel()
    expect(store.getState().leftPanelCollapsed).toBe(true)
    store.getState().toggleLeftPanel()
    expect(store.getState().leftPanelCollapsed).toBe(false)
  })

  it('setTheme updates theme', () => {
    expect(store.getState().theme).toBe('system')
    store.getState().setTheme('dark')
    expect(store.getState().theme).toBe('dark')
  })
})

describe('ValidationSlice', () => {
  let store: ReturnType<typeof createMockStore<ValidationSlice>>

  beforeEach(() => {
    store = createMockStore<ValidationSlice>(createValidationSlice)
  })

  it('initial state has null validationResult', () => {
    expect(store.getState().validationResult).toBeNull()
  })
})

describe('ExecutionSlice', () => {
  let store: ReturnType<typeof createMockStore<ExecutionSlice>>

  beforeEach(() => {
    store = createMockStore<ExecutionSlice>(createExecutionSlice)
  })

  it('setNodeStatus updates the record', () => {
    store.getState().setNodeStatus('node-1', { state: 'running', startedAt: '2024-01-01' })
    expect(store.getState().nodeStatuses['node-1']).toEqual({ state: 'running', startedAt: '2024-01-01' })
  })
})

describe('LibrarySlice', () => {
  let store: ReturnType<typeof createMockStore<LibrarySlice>>

  beforeEach(() => {
    store = createMockStore<LibrarySlice>(createLibrarySlice)
  })

  it('setLibrarySearch updates search string', () => {
    expect(store.getState().librarySearch).toBe('')
    store.getState().setLibrarySearch('tools')
    expect(store.getState().librarySearch).toBe('tools')
  })
})
