import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import type { BilingualText } from '../data/schema'

interface QuestionHeaderProps {
  questionNumber: number
  points: number
  stem: BilingualText
}

export function QuestionHeader({ questionNumber, points, stem }: QuestionHeaderProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* Question label + points badge */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t(labels.question)} {questionNumber}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt text-text-muted font-medium">
          {points} {points === 1 ? t(labels.point) : t(labels.points)}
        </span>
      </div>

      {/* Stem */}
      <h2 className="text-xl font-heading font-semibold mb-6 leading-relaxed">
        {t(stem)}
      </h2>
    </>
  )
}
