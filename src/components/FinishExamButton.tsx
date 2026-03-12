import { useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'wouter'
import { useLanguage } from '../context/LanguageContext'
import { useExam } from '../context/ExamContext'
import { labels } from '../utils/labels'
import { getQuestionAnswerStatus } from '../utils/questionStatus'
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

  const modalContent = (
    <>
      {/* Unanswered questions modal */}
      {modal === 'unanswered' && (
        <ConfirmModal
          icon={<HelpCircle size={20} className="text-blue-500" />}
          iconBg="bg-blue-500/15"
          title={t(labels.unansweredQuestionsTitle)}
          body={t(labels.unansweredQuestionsBody)}
          count={unansweredCount}
          countLabel={
            unansweredCount === 1
              ? t({ de: 'Frage', en: 'question' })
              : t({ de: 'Fragen', en: 'questions' })
          }
          cancelIcon={<HelpCircle size={14} />}
          cancelLabel={t(labels.reviewFlagged)}
          onCancel={() => setModal(null)}
          onConfirm={handleAfterUnanswered}
        />
      )}

      {/* Flagged questions modal */}
      {modal === 'flagged' && (
        <ConfirmModal
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          iconBg="bg-amber-500/15"
          title={t(labels.flaggedQuestionsTitle)}
          body={t(labels.flaggedQuestionsBody)}
          count={flaggedQuestions.size}
          countLabel={
            flaggedQuestions.size === 1
              ? t({ de: 'Frage', en: 'question' })
              : t({ de: 'Fragen', en: 'questions' })
          }
          cancelIcon={<Bookmark size={14} />}
          cancelLabel={t(labels.reviewFlagged)}
          onCancel={() => setModal(null)}
          onConfirm={doFinish}
        />
      )}
    </>
  )

  return (
    <>
      {children(handleFinish)}
      {modal && createPortal(modalContent, document.body)}
    </>
  )
}

/* ── Shared confirmation modal ──────────────────────────────── */

interface ConfirmModalProps {
  icon: ReactNode
  iconBg: string
  title: string
  body: string
  count: number
  countLabel: string
  cancelIcon: ReactNode
  cancelLabel: string
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmModal({
  icon,
  iconBg,
  title,
  body,
  count,
  countLabel,
  cancelIcon,
  cancelLabel,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const { t } = useLanguage()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative bg-bg border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <h2 className="font-heading font-semibold text-lg">{title}</h2>
        </div>
        <p className="text-sm text-text-muted mb-2">{body}</p>
        <p className="text-sm text-text-muted mb-6">
          {count} {countLabel}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-border bg-surface rounded-xl font-medium text-sm transition-all hover:bg-surface-hover cursor-pointer"
          >
            {cancelIcon}
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-xl font-medium text-sm transition-all hover:opacity-90 cursor-pointer"
          >
            <CheckCircle2 size={14} />
            {t(labels.finishAnyway)}
          </button>
        </div>
      </div>
    </div>
  )
}
