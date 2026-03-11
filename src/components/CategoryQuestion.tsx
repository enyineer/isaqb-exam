import { useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import type { CategoryQuestion as CategoryQuestionType } from '../data/schema'
import { AnswerIndicator } from './AnswerIndicator'
import { QuestionHeader } from './QuestionHeader'
import { labels } from '../utils/labels'
import { seededShuffle } from '../utils/shuffle'

interface CategoryQuestionProps {
  question: CategoryQuestionType
  questionNumber: number
}

export function CategoryQuestion({ question, questionNumber }: CategoryQuestionProps) {
  const { t } = useLanguage()
  const { answers, setCategoryAnswer, shuffleSeed } = useExam()

  const assignments = (answers[question.id] as Record<string, string>) || {}
  const assignedCount = Object.keys(assignments).length

  // Shuffle statements deterministically per attempt + question
  const shuffledStatements = useMemo(
    () => seededShuffle(question.statements, shuffleSeed + question.id.length),
    [question.statements, question.id, shuffleSeed],
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
        <AnswerIndicator selected={assignedCount} required={question.statements.length} />
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
              className="p-4 rounded-xl border-2 border-border bg-surface transition-all duration-200"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-bold text-text-muted bg-surface-alt w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                  {stmt.id}
                </span>
                <span className="text-sm flex-1">{t(stmt.text)}</span>
                <kbd className="hidden sm:inline-flex shrink-0 text-[10px] text-text-muted bg-surface-alt px-1.5 py-0.5 rounded border border-border font-mono">
                  {index + 1}
                </kbd>
              </div>
              <div className="flex flex-wrap gap-2 pl-9">
                <span className="text-xs text-text-muted self-center mr-1">
                  {t(labels.assignToCategory)}
                </span>
                {question.categories.map(cat => (
                  <button
                    key={cat.label}
                    className={`category-btn ${currentAssignment === cat.label ? 'active' : ''}`}
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
