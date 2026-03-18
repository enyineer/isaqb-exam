import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface ConfirmModalProps {
  /** Icon rendered in the header badge */
  icon: ReactNode
  /** Background class for the icon badge (e.g. "bg-red-500/15") */
  iconBg: string
  /** Modal title */
  title: string
  /** Body text — can be a string or ReactNode */
  body: ReactNode
  /** Label for the confirm button */
  confirmLabel: string
  /** Icon for the confirm button */
  confirmIcon?: ReactNode
  /** Styling variant for the confirm button */
  confirmVariant?: 'success' | 'danger'
  /** Label for the cancel button */
  cancelLabel: string
  /** Icon for the cancel button */
  cancelIcon?: ReactNode
  /** Called when the user cancels */
  onCancel: () => void
  /** Called when the user confirms */
  onConfirm: () => void
}

/**
 * Generic confirmation modal — animated, portal-rendered, with backdrop blur.
 * Use for any action that requires user confirmation.
 */
export function ConfirmModal({
  icon,
  iconBg,
  title,
  body,
  confirmLabel,
  confirmIcon,
  confirmVariant = 'success',
  cancelLabel,
  cancelIcon,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const confirmBg = confirmVariant === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-success hover:opacity-90'

  return createPortal(
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
        <div className="text-sm text-text-muted mb-6">{body}</div>
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
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-medium text-sm transition-all cursor-pointer ${confirmBg}`}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
