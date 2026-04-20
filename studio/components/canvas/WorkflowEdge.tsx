import { memo } from 'react'
import {
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react'

export interface WorkflowEdgeData {
  condition?: string
  label?: string
}

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  style,
}: EdgeProps & { data?: WorkflowEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const isConditional = !!data?.condition

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isConditional ? 'rgb(245,158,11)' : 'hsl(238, 76%, 67%)',
          strokeWidth: isConditional ? 2.5 : 2,
          strokeDasharray: isConditional ? '8 4' : undefined,
          opacity: isConditional ? 1 : 0.6,
          ...style,
        }}
      />

      {isConditional && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute cursor-pointer"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={(e) => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('edge:click', { detail: { id, sourceX, sourceY, targetX, targetY, condition: data?.condition } }))
            }}
          >
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/25 text-amber-400 border border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm shadow-md hover:bg-amber-500/35 transition-colors">
              ⚡ {data!.condition}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
