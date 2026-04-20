'use client'

import { useConfigureSuggestions } from '@copilotkit/react-core/v2'
import { useAppStore } from '@/store'

/**
 * Dynamic suggestions based on workspace state.
 */
export function CopilotSuggestions() {
  const data = useAppStore(s => s.data)
  const selection = useAppStore(s => s.selection)
  const validationResult = useAppStore(s => s.validationResult)

  const hasWorkflows = data && Object.keys(data.workflows || {}).length > 0
  const hasErrors = (validationResult as any)?.errors?.length > 0
  const hasSelection = !!selection

  useConfigureSuggestions({
    suggestions: [
      ...(hasWorkflows ? [] : [
        { title: '🚀 Create workflow', message: 'Help me create a new AgentFlow workflow' },
      ]),
      ...(hasWorkflows ? [
        { title: '📋 Validate', message: 'Validate the workspace and show me any errors' },
      ] : []),
      ...(hasErrors ? [
        { title: '🔧 Fix errors', message: 'Show me the validation errors and help fix them' },
      ] : []),
      ...(hasSelection ? [
        { title: '🔍 Explain this', message: 'Explain what the currently selected item does' },
      ] : []),
      ...(!hasSelection && hasWorkflows ? [
        { title: '🗺️ Overview', message: 'Give me an overview of this workspace' },
      ] : []),
    ].slice(0, 3),
    available: 'always',
  })

  return null
}
