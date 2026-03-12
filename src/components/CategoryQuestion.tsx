import { useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import type { CategoryQuestion as CategoryQuestionType } from '../data/schema'
import { AnswerIndicator } from './AnswerIndicator'
import { QuestionHeader } from './QuestionHeader'
import { labels } from '../utils/labels'
import { seededShuffle } from '../utils/shuffle'
import { getQuestionAnswerStatus } from '../utils/questionStatus'

interface CategoryQuestionProps {
  question: CategoryQuestionType
  questionNumber: number
}

export function CategoryQuestion({ question, questionNumber }: CategoryQuestionProps) {
  const { t } = useLanguage()
  const { answers, setCategoryAnswer, shuffleSeed } = useExam()

  const assignments = (answers[question.id] as Record<string, string>) || {}
  const assignedCount = Object.keys(assignments).length
  const status = getQuestionAnswerStatus(question, answers[question.id])

  // Shuffle statements deterministically per attempt + question
  const shuffledStatements = useMemo(
    () => seededShuffle(question.statements, shuffleSeed + question.id.length),
    [question.statements, question.id, shuffleSeed],
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
        <AnswerIndicator selected={assignedCount} required={question.statements.length} status={status} />
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {question.categories.map((cat, catIdx) => (
          <div
            key={cat.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-alt text-sm font-medium"
          >
            <span className="w-3 h-3 rounded-full bg-primary" style={{ opacity: 0.3 + catIdx * 0.4 }} />
            <span>{t(cat.text)}</span>
          </div>
        ))}
      </div>

      {/* Statements */}
      <div className="space-y-4" role="group" aria-label={`${t(labels.question)} ${questionNumber}`}>
        {shuffledStatements.map((stmt, index) => {
          const currentAssignment = assignments[stmt.id]
          return (
            <div
              key={stmt.id}
              className="rounded-xl border-2 border-border bg-surface transition-all duration-200 overflow-hidden"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="shrink-0 text-xs font-bold w-7 h-7 rounded-lg bg-surface-alt text-text-muted flex items-center justify-center">
                  {stmt.id}
                </span>
                <span className="text-sm flex-1">{t(stmt.text)}</span>
                <kbd className="hidden sm:inline-flex shrink-0 text-[10px] text-text-muted bg-surface-alt px-1.5 py-0.5 rounded border border-border font-mono">
                  {index + 1}
                </kbd>
              </div>
              <div className="flex border-t border-border">
                {question.categories.map((cat, catIdx) => (
                  <button
                    key={cat.label}
                    className={`flex-1 py-2.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                      catIdx > 0 ? 'border-l border-border' : ''
                    } ${
                      currentAssignment === cat.label
                        ? 'bg-primary text-white'
                        : 'bg-surface-alt/50 text-text-muted hover:bg-surface-hover'
                    }`}
                    onClick={() => setCategoryAnswer(question.id, stmt.id, cat.label)}
                    aria-pressed={currentAssignment === cat.label}
                  >
                    {t(cat.text)}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
