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
  edgeType?: 'default' | 'conditional' | 'condition-in' | 'condition-out'
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
  const edgeType = data?.edgeType ?? (isConditional ? 'conditional' : 'default')

  const edgeStyles: Record<string, { stroke: string; width: number; dash?: string; opacity: number }> = {
    default:        { stroke: 'var(--node-step)',    width: 2,   opacity: 0.5 },
    conditional:    { stroke: 'rgb(245,158,11)',     width: 2.5, dash: '8 4', opacity: 1 },
    'condition-in': { stroke: 'rgb(245,158,11)',     width: 2,   dash: '6 3', opacity: 0.7 },
    'condition-out':{ stroke: 'rgb(245,158,11)',     width: 2,   opacity: 0.8 },
  }
  const es = edgeStyles[edgeType] ?? edgeStyles.default

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: es.stroke,
          strokeWidth: es.width,
          strokeDasharray: es.dash,
          opacity: es.opacity,
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
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/25 text-amber-400 border border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm shadow-md hover:bg-amber-500/35 transition-colors max-w-[180px]">
              <span className="shrink-0">⚡</span> <span className="truncate">{data!.condition}</span>
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
