import { WorkflowNode } from './WorkflowNode'
import { WorkflowEdge } from './WorkflowEdge'
import { ResourceNode } from './ResourceNode'

export const nodeTypes = {
  step: WorkflowNode,
  router: WorkflowNode,
  'sub-workflow': WorkflowNode,
  resource: ResourceNode,
}
export const edgeTypes = { custom: WorkflowEdge, workflow: WorkflowEdge }
