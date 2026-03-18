import { useState, useCallback, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import { labels } from '../utils/labels'
import { getQuestionAnswerStatus } from '../utils/questionStatus'
import { ConfirmModal } from './ConfirmModal'
import { AlertTriangle, Bookmark, CheckCircle2, HelpCircle } from 'lucide-react'

type ModalType = 'unanswered' | 'flagged' | null

interface FinishExamButtonProps {
  /** The trigger element — receives an onClick handler */
  children: (onClick: () => void) => ReactNode
}

/**
 * Shared finish-exam flow used by both the footer "Finish" button and the
 * progress-bar quick-finish button.
 *
 * Modal priority:
 * 1. Unanswered questions → warn first
 * 2. Flagged questions → warn second
 * 3. Otherwise → finish immediately
 */
export function FinishExamButton({ children }: FinishExamButtonProps) {
  const { t } = useLanguage()
  const { questions, answers, flaggedQuestions, finishExam } = useExam()
  const [, navigate] = useLocation()
  const [modal, setModal] = useState<ModalType>(null)

  const unansweredCount = questions.filter(
    (q) => getQuestionAnswerStatus(q, answers[q.id]) === 'none',
  ).length

  const doFinish = useCallback(() => {
    setModal(null)
    finishExam()
    navigate('/results')
  }, [finishExam, navigate])

  /** Entry point — runs the check cascade */
  const handleFinish = useCallback(() => {
    if (unansweredCount > 0) {
      setModal('unanswered')
      return
    }
    if (flaggedQuestions.size > 0) {
      setModal('flagged')
      return
    }
    doFinish()
  }, [unansweredCount, flaggedQuestions.size, doFinish])

  /** Called after the user dismisses the unanswered modal with "Finish Anyway" */
  const handleAfterUnanswered = useCallback(() => {
    setModal(null)
    if (flaggedQuestions.size > 0) {
      setModal('flagged')
      return
    }
    doFinish()
  }, [flaggedQuestions.size, doFinish])

  const questionLabel = (count: number) =>
    count === 1
      ? t({ de: 'Frage', en: 'question' })
      : t({ de: 'Fragen', en: 'questions' })

  return (
    <>
      {children(handleFinish)}

      {/* Unanswered questions modal */}
      {modal === 'unanswered' && (
        <ConfirmModal
          icon={<HelpCircle size={20} className="text-blue-500" />}
          iconBg="bg-blue-500/15"
          title={t(labels.unansweredQuestionsTitle)}
          body={<><p className="mb-2">{t(labels.unansweredQuestionsBody)}</p><p>{unansweredCount} {questionLabel(unansweredCount)}</p></>}
          cancelIcon={<HelpCircle size={14} />}
          cancelLabel={t(labels.reviewFlagged)}
          onCancel={() => setModal(null)}
          confirmIcon={<CheckCircle2 size={14} />}
          confirmLabel={t(labels.finishAnyway)}
          onConfirm={handleAfterUnanswered}
        />
      )}

      {/* Flagged questions modal */}
      {modal === 'flagged' && (
        <ConfirmModal
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          iconBg="bg-amber-500/15"
          title={t(labels.flaggedQuestionsTitle)}
          body={<><p className="mb-2">{t(labels.flaggedQuestionsBody)}</p><p>{flaggedQuestions.size} {questionLabel(flaggedQuestions.size)}</p></>}
          cancelIcon={<Bookmark size={14} />}
          cancelLabel={t(labels.reviewFlagged)}
          onCancel={() => setModal(null)}
          confirmIcon={<CheckCircle2 size={14} />}
          confirmLabel={t(labels.finishAnyway)}
          onConfirm={doFinish}
        />
      )}
    </>
  )
}
