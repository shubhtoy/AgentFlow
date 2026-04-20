import { type StateCreator } from 'zustand'

export interface ToolCallDisplay {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  status: 'pending' | 'success' | 'error'
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCallDisplay[]
}

export interface ProviderConfig {
  provider: string | null
  model: string | null
  hasKey: boolean
}

export interface AgentSlice {
  agentMessages: AgentMessage[]
  agentIsStreaming: boolean
  agentError: string | null
  agentConfig: ProviderConfig

  addAgentMessage: (msg: AgentMessage) => void
  updateLastAgentMessage: (update: Partial<AgentMessage>) => void
  appendToLastAgentContent: (text: string) => void
  addToolCallToLast: (tc: ToolCallDisplay) => void
  updateToolCallResult: (id: string, result: string, isError: boolean) => void
  setAgentStreaming: (streaming: boolean) => void
  setAgentError: (error: string | null) => void
  setAgentConfig: (config: ProviderConfig) => void
  resetAgent: () => void
}

export const createAgentSlice: StateCreator<AgentSlice> = (set) => ({
  agentMessages: [],
  agentIsStreaming: false,
  agentError: null,
  agentConfig: { provider: null, model: null, hasKey: false },

  addAgentMessage: (msg) => set((s) => ({
    agentMessages: [...s.agentMessages, msg],
  })),

  updateLastAgentMessage: (update) => set((s) => {
    const msgs = [...s.agentMessages]
    if (msgs.length > 0) {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...update }
    }
    return { agentMessages: msgs }
  }),

  appendToLastAgentContent: (text) => set((s) => {
    const msgs = [...s.agentMessages]
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      msgs[msgs.length - 1] = {
        ...msgs[msgs.length - 1],
        content: msgs[msgs.length - 1].content + text,
      }
    }
    return { agentMessages: msgs }
  }),

  addToolCallToLast: (tc) => set((s) => {
    const msgs = [...s.agentMessages]
    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
      const last = msgs[msgs.length - 1]
      msgs[msgs.length - 1] = {
        ...last,
        toolCalls: [...(last.toolCalls || []), tc],
      }
    }
    return { agentMessages: msgs }
  }),

  updateToolCallResult: (id, result, isError) => set((s) => {
    const msgs = [...s.agentMessages]
    for (let i = msgs.length - 1; i >= 0; i--) {
      const tcs = msgs[i].toolCalls
      if (!tcs) continue
      const idx = tcs.findIndex(tc => tc.id === id)
      if (idx >= 0) {
        const updated = [...tcs]
        updated[idx] = { ...updated[idx], result, status: isError ? 'error' : 'success' }
        msgs[i] = { ...msgs[i], toolCalls: updated }
        break
      }
    }
    return { agentMessages: msgs }
  }),

  setAgentStreaming: (streaming) => set({ agentIsStreaming: streaming }),
  setAgentError: (error) => set({ agentError: error }),
  setAgentConfig: (config) => set({ agentConfig: config }),

  resetAgent: () => set({
    agentMessages: [],
    agentIsStreaming: false,
    agentError: null,
  }),
})
