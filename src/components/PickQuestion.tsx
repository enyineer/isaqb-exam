import { useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import type { PickQuestion as PickQuestionType } from '../data/schema'
import { AnswerIndicator } from './AnswerIndicator'
import { QuestionHeader } from './QuestionHeader'
import { labels } from '../utils/labels'
import { seededShuffle } from '../utils/shuffle'

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

  // Shuffle options deterministically per attempt + question
  const shuffledOptions = useMemo(
    () => seededShuffle(question.options, shuffleSeed + question.id.length),
    [question.options, question.id, shuffleSeed],
  )

  return (
    <div className="page-enter">
      <QuestionHeader
        questionNumber={questionNumber}
        points={question.points}
        stem={question.stem}
      />

      {/* Answer indicator */}
      <div className="mb-4">
        <AnswerIndicator selected={selectedIds.length} required={correctCount} />
      </div>

      {/* Options */}
      <div className="space-y-3" role="group" aria-label={`${t(labels.question)} ${questionNumber}`}>
        {shuffledOptions.map((option, index) => {
          const isSelected = selectedIds.includes(option.id)
          return (
            <button
              key={option.id}
              className={`option-card w-full text-left flex items-start gap-3 ${isSelected ? 'selected' : ''}`}
              onClick={() => togglePickAnswer(question.id, option.id)}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
            >
              {/* Checkbox indicator */}
              <span className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                isSelected
                  ? 'bg-primary border-primary'
                  : 'border-border'
              }`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>

              <span className="flex-1">
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs font-bold text-text-muted bg-surface-alt w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                    {LETTERS[index]}
                  </span>
                  <span className="text-sm">{t(option.text)}</span>
                </span>
              </span>

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
