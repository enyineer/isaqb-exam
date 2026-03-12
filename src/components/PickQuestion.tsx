import { useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import type { PickQuestion as PickQuestionType } from '../data/schema'
import { AnswerIndicator } from './AnswerIndicator'
import { QuestionHeader } from './QuestionHeader'
import { labels } from '../utils/labels'
import { seededShuffle } from '../utils/shuffle'
import { getQuestionAnswerStatus } from '../utils/questionStatus'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

interface PickQuestionProps {
  question: PickQuestionType
  questionNumber: number
}

export function PickQuestion({ question, questionNumber }: PickQuestionProps) {
  const { t } = useLanguage()
  const { answers, togglePickAnswer, shuffleSeed } = useExam()

  const selectedIds = (answers[question.id] as string[]) || []
  const correctCount = question.options.filter(o => o.correct).length
  const status = getQuestionAnswerStatus(question, answers[question.id])

  // Shuffle options deterministically per attempt + question
  const shuffledOptions = useMemo(
    () => seededShuffle(question.options, shuffleSeed + question.id.length),
    [question.options, question.id, shuffleSeed],
  )

  return (
    <div>
      <QuestionHeader
        questionNumber={questionNumber}
        points={question.points}
        stem={question.stem}
      />

      {/* Answer indicator */}
      <div className="mb-4">
        <AnswerIndicator selected={selectedIds.length} required={correctCount} status={status} />
      </div>

      {/* Options */}
      <div className="space-y-3" role="group" aria-label={`${t(labels.question)} ${questionNumber}`}>
        {shuffledOptions.map((option, index) => {
          const isSelected = selectedIds.includes(option.id)
          return (
            <button
              key={option.id}
              className={`option-card w-full text-left flex items-center gap-3 ${isSelected ? 'selected' : ''}`}
              onClick={() => togglePickAnswer(question.id, option.id)}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
            >
              <span className={`shrink-0 text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isSelected
                  ? 'bg-primary text-white shadow-sm shadow-primary/25'
                  : 'bg-surface-alt text-text-muted'
              }`}>
                {LETTERS[index]}
              </span>
              <span className="flex-1 text-sm">{t(option.text)}</span>

              {/* Keyboard shortcut hint */}
              <kbd className="hidden sm:inline-flex shrink-0 text-[10px] text-text-muted bg-surface-alt px-1.5 py-0.5 rounded border border-border font-mono">
                {index + 1}
              </kbd>
            </button>
          )
        })}
      </div>
    </div>
  )
}
