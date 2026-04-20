import { type StateCreator } from 'zustand'

export interface ValidationSlice {
  validationResult: any | null
  validate: () => Promise<void>
}

export const createValidationSlice: StateCreator<ValidationSlice> = (set) => ({
  validationResult: null,
  validate: async () => {
    try {
      const res = await fetch('/api/validate')
      const data = await res.json()
      set({ validationResult: data })
    } catch (err) {
      console.error('Validation failed:', err)
    }
  },
})
