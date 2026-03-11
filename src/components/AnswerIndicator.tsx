import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'

interface AnswerIndicatorProps {
  selected: number
  required: number
}

export function AnswerIndicator({ selected, required }: AnswerIndicatorProps) {
  const { t } = useLanguage()

  let status: 'too-few' | 'correct' | 'too-many'
  let colorClass: string
  let label: string

  if (selected < required) {
    status = 'too-few'
    colorClass = 'bg-[var(--color-indicator-too-few)] text-white'
    label = t(labels.tooFew)
  } else if (selected === required) {
    status = 'correct'
    colorClass = 'bg-[var(--color-indicator-correct)] text-white'
    label = t(labels.correctCount)
  } else {
    status = 'too-many'
    colorClass = 'bg-[var(--color-indicator-too-many)] text-white'
    label = t(labels.tooMany)
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
