import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export type ReviewStatus = 'correct' | 'incorrect' | 'missed' | 'neutral'

const statusConfig: Record<ReviewStatus, { bg: string; icon: ReactNode | null }> = {
  correct: {
    bg: 'bg-green-500/10 text-green-700 dark:text-green-400',
    icon: <CheckCircle2 size={14} />,
  },
  incorrect: {
    bg: 'bg-red-500/10 text-red-700 dark:text-red-400',
    icon: <XCircle size={14} />,
  },
  missed: {
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    icon: <MinusCircle size={14} />,
  },
  neutral: {
    bg: 'opacity-60',
    icon: null,
  },
}

interface ReviewResultItemProps {
  status: ReviewStatus
  /** Item ID shown as a small label (e.g. "A", "B", or statement IDs) */
  itemId: string
  /** Main text content */
  text: string
  /** Optional secondary line rendered below the main content (e.g. category assignment) */
  secondaryContent?: ReactNode
}

export function ReviewResultItem({ status, itemId, text, secondaryContent }: ReviewResultItemProps) {
  const config = statusConfig[status]
  const isHighlighted = status !== 'neutral'

  return (
    <div
      className={`text-[13px] sm:text-sm rounded-lg ${
        isHighlighted ? 'px-2.5 sm:px-3 py-1.5' : 'px-2.5 sm:px-3 py-1'
      } ${config.bg}`}
    >
      <div className="flex items-start gap-1.5 sm:gap-2">
        <span className="shrink-0 mt-0.5">
          {config.icon ?? <span className="inline-block w-3.5" />}
        </span>
        <span className="font-mono text-xs font-bold opacity-50 shrink-0 mt-px">
          {itemId}
        </span>
        <span className="min-w-0">{text}</span>
      </div>
      {secondaryContent && (
        <div className="flex items-center gap-1.5 mt-1 ml-[calc(14px+0.375rem+1rem+0.375rem)] sm:ml-[calc(14px+0.5rem+1rem+0.5rem)] text-xs opacity-70">
          {secondaryContent}
        </div>
      )}
    </div>
  )
}
