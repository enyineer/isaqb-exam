import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import type { AnswerStatus } from '../utils/questionStatus'

interface AnswerIndicatorProps {
  selected: number
  required: number
  status: AnswerStatus
}

export function AnswerIndicator({ selected, required, status }: AnswerIndicatorProps) {
  const { t } = useLanguage()

  let colorClass: string
  let label: string

  switch (status) {
    case 'none':
    case 'too-few':
      colorClass = 'bg-[var(--color-indicator-too-few)] text-white'
      label = t(labels.tooFew)
      break
    case 'correct':
      colorClass = 'bg-[var(--color-indicator-correct)] text-white'
      label = t(labels.correctCount)
      break
    case 'too-many':
      colorClass = 'bg-[var(--color-indicator-too-many)] text-white'
      label = t(labels.tooMany)
      break
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${colorClass}`}
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${selected} ${t(labels.selected)}, ${required} ${t(labels.required)}`}
    >
      <span className="font-bold">{selected}/{required}</span>
      <span className="text-xs opacity-90">{label}</span>
    </div>
  )
}
