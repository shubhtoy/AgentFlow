import { type StateCreator } from 'zustand'

export interface LibrarySlice {
  libraryEntries: any[]
  librarySearch: string
  libraryLoading: boolean
  loadLibrary: () => Promise<void>
  setLibrarySearch: (q: string) => void
}

export const createLibrarySlice: StateCreator<LibrarySlice> = (set) => ({
  libraryEntries: [],
  librarySearch: '',
  libraryLoading: false,
  loadLibrary: async () => {
    set({ libraryLoading: true })
    try {
      const res = await fetch('/api/library')
      const data = await res.json()
      set({ libraryEntries: data.entries ?? [] })
    } catch (err) {
      console.error('Failed to load library:', err)
    } finally {
      set({ libraryLoading: false })
    }
  },
  setLibrarySearch: (q) => set({ librarySearch: q }),
})
