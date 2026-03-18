import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'wouter'
import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import { PageLayout } from '../components/PageLayout'
import { Footer } from '../components/Footer'
import { LoginButtons } from '../components/LoginButtons'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import {
  adminFetchEntries,
  adminDeleteEntry,
  adminFetchBlocked,
  adminBlockUser,
  adminUnblockUser,
  adminFetchAdmins,
  adminAddAdmin,
  adminRemoveAdmin,
  type AdminList,
  type AdminLeaderboardEntry,
} from '../utils/admin'
import {
  Shield,
  ArrowLeft,
  Loader2,
  ShieldX,
  LogIn,
  LogOut,
  Trash2,
  UserX,
  UserCheck,
  UserPlus,
  UserMinus,
  Copy,
  Check,
  Clock,
  AlertTriangle,
} from 'lucide-react'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function AdminPage() {
  const { t } = useLanguage()
  const [, navigate] = useLocation()

  // Auth & admin state
  const { authStatus, isAdmin, authLoading, logout } = useAuth()
  const loading = authLoading

  // Data
  const [entries, setEntries] = useState<AdminLeaderboardEntry[]>([])
  const [blocked, setBlocked] = useState<string[]>([])
  const [admins, setAdmins] = useState<AdminList | null>(null)

  // Inputs
  const [blockInput, setBlockInput] = useState('')
  const [adminInput, setAdminInput] = useState('')
  const [adminNameInput, setAdminNameInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ userId: string; commitSha: string } | null>(null)
  const [pendingBlock, setPendingBlock] = useState<string | null>(null)
  const [pendingRemoveAdmin, setPendingRemoveAdmin] = useState<string | null>(null)

  // Load admin data once admin is confirmed
  const loadData = useCallback(async () => {
    if (!isAdmin) return
    const [e, b, a] = await Promise.all([
      adminFetchEntries(),
      adminFetchBlocked(),
      adminFetchAdmins(),
    ])
    setEntries(e)
    setBlocked(b)
    setAdmins(a)
  }, [isAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = (userId: string, commitSha: string) => {
    setPendingDelete({ userId, commitSha })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await adminDeleteEntry(pendingDelete.userId, pendingDelete.commitSha)
    setEntries(prev => prev.filter(e => !(e.id === pendingDelete.userId && e.commitSha === pendingDelete.commitSha)))
    setPendingDelete(null)
  }

  const handleBlock = () => {
    const id = blockInput.trim()
    if (!id) return
    setPendingBlock(id)
  }

  const confirmBlock = async () => {
    if (!pendingBlock) return
    await adminBlockUser(pendingBlock)
    setBlocked(prev => [...prev, pendingBlock])
    setBlockInput('')
    setPendingBlock(null)
  }

  const handleUnblock = async (userId: string) => {
    await adminUnblockUser(userId)
    setBlocked(prev => prev.filter(id => id !== userId))
  }

  const handleAddAdmin = async () => {
    const id = adminInput.trim()
    const name = adminNameInput.trim()
    if (!id) return
    await adminAddAdmin(id, name)
    setAdmins(prev => prev ? { ...prev, dynamicAdmins: [...prev.dynamicAdmins, { id, name }] } : prev)
    setAdminInput('')
    setAdminNameInput('')
  }

  const handleRemoveAdmin = (userId: string) => {
    setPendingRemoveAdmin(userId)
  }

  const confirmRemoveAdmin = async () => {
    if (!pendingRemoveAdmin) return
    await adminRemoveAdmin(pendingRemoveAdmin)
    setAdmins(prev => prev ? { ...prev, dynamicAdmins: prev.dynamicAdmins.filter(a => a.id !== pendingRemoveAdmin) } : prev)
    setPendingRemoveAdmin(null)
  }

  const handleCopyId = async (id: string) => {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout>
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
          <div className="text-center py-16 page-enter">
            <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={32} />
            <p className="text-text-muted">{t(labels.adminLoading)}</p>
          </div>
        </main>
      </PageLayout>
    )
  }

  // ─── Not logged in ──────────────────────────────────────────────────
  if (!authStatus?.authenticated) {
    return (
      <PageLayout>
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
          <div className="text-center py-16 page-enter">
            <LogIn className="mx-auto mb-3 text-text-muted opacity-40" size={40} />
            <p className="text-text-muted mb-6">{t(labels.adminNotLoggedIn)}</p>
            <LoginButtons returnTo="#/admin" />
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-sm text-text-muted hover:text-text transition-colors cursor-pointer underline"
            >
              {t(labels.backToStart)}
            </button>
          </div>
        </main>
      </PageLayout>
    )
  }

  // ─── Not admin ──────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <PageLayout>
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
          <div className="text-center py-16 page-enter">
            <ShieldX className="mx-auto mb-3 text-red-500" size={40} />
            <p className="text-text-muted">{t(labels.adminAccessDenied)}</p>

            {/* Show user their ID so they can share it with an admin */}
            {authStatus.authenticated && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border">
                <span className="text-xs text-text-muted">{t(labels.adminYourId)}:</span>
                <code className="text-sm font-mono font-semibold">{authStatus.user.id}</code>
                <button
                  onClick={() => handleCopyId(authStatus.user.id)}
                  className="p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer"
                  aria-label="Copy ID"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-text-muted" />}
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-lg bg-primary text-white font-medium cursor-pointer hover:opacity-90 transition-opacity"
              >
                {t(labels.backToStart)}
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer text-sm font-medium"
              >
                <LogOut size={14} />
                {t({ de: 'Abmelden', en: 'Log out' })}
              </button>
            </div>
          </div>
        </main>
      </PageLayout>
    )
  }

  // ─── Admin Panel ────────────────────────────────────────────────────
  return (
    <>
    <PageLayout>
      <main id="main-content" className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="page-enter">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="text-primary" size={28} />
              <h1 className="font-heading text-2xl sm:text-3xl font-bold">
                {t(labels.adminTitle)}
              </h1>
            </div>
            <button
              onClick={logout}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer text-sm font-medium"
            >
              <LogOut size={14} />
              {t({ de: 'Abmelden', en: 'Log out' })}
            </button>
          </div>

          {/* ─── Entries Table ──────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="font-heading text-lg font-semibold mb-3">
              {t(labels.adminEntries)} ({entries.length})
            </h2>
            {entries.length === 0 ? (
              <p className="text-text-muted text-sm">{t(labels.adminEntriesEmpty)}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border-2 border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface border-b-2 border-border text-text-muted">
                      <th className="px-3 py-3 text-left font-semibold">{t(labels.leaderboardUser)}</th>
                      <th className="px-3 py-3 text-left font-semibold text-xs">ID</th>
                      <th className="px-3 py-3 text-right font-semibold">{t(labels.leaderboardScore)}</th>
                      <th className="px-3 py-3 text-right font-semibold">{t(labels.leaderboardPercentage)}</th>
                      <th className="px-3 py-3 text-right font-semibold hidden sm:table-cell">{t(labels.leaderboardTime)}</th>
                      <th className="px-3 py-3 text-right font-semibold hidden md:table-cell">Version</th>
                      <th className="px-3 py-3 text-right font-semibold hidden md:table-cell">{t(labels.leaderboardDate)}</th>
                      <th className="px-3 py-3 text-center font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr
                        key={`${entry.id}-${entry.commitSha}`}
                        className="border-b border-border last:border-b-0 hover:bg-surface-hover/50 transition-colors"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={entry.avatarUrl}
                              alt=""
                              className="w-6 h-6 rounded-full bg-primary/20"
                              loading="lazy"
                            />
                            <span className="font-medium truncate max-w-[100px]">{entry.displayName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <code className="text-xs text-text-muted font-mono">{entry.id}</code>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">
                          {entry.score.toFixed(1)}<span className="text-text-muted">/{entry.maxScore}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold">
                          {entry.percentage.toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-text-muted hidden sm:table-cell">
                          <Clock size={12} className="inline mr-1 opacity-60" />
                          {formatElapsed(entry.timeMs)}
                        </td>
                        <td className="px-3 py-3 text-right text-text-muted hidden md:table-cell font-mono text-xs">
                          {entry.commitSha.slice(0, 7)}
                        </td>
                        <td className="px-3 py-3 text-right text-text-muted hidden md:table-cell">
                          {formatDate(entry.submittedAt)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleDelete(entry.id, entry.commitSha)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer"
                            aria-label={t(labels.adminDelete)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ─── Blocked Users ──────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="font-heading text-lg font-semibold mb-3">
              {t(labels.adminBlocked)} ({blocked.length})
            </h2>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={blockInput}
                onChange={e => setBlockInput(e.target.value)}
                placeholder={t(labels.adminBlockPlaceholder)}
                className="flex-1 px-3 py-2 rounded-lg border-2 border-border bg-surface text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleBlock()}
              />
              <button
                onClick={handleBlock}
                disabled={!blockInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserX size={16} />
                {t(labels.adminBlock)}
              </button>
            </div>

            {blocked.length === 0 ? (
              <p className="text-text-muted text-sm">{t(labels.adminBlockedEmpty)}</p>
            ) : (
              <div className="space-y-2">
                {blocked.map(userId => (
                  <div
                    key={userId}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border-2 border-border bg-surface"
                  >
                    <code className="text-sm font-mono">{userId}</code>
                    <button
                      onClick={() => handleUnblock(userId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 font-medium text-xs cursor-pointer hover:bg-green-500/20 transition-colors"
                    >
                      <UserCheck size={14} />
                      {t(labels.adminUnblock)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Admin Management ──────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="font-heading text-lg font-semibold mb-3">
              {t(labels.adminAdmins)}
            </h2>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={adminInput}
                onChange={e => setAdminInput(e.target.value)}
                placeholder={t(labels.adminAdminPlaceholder)}
                className="flex-1 px-3 py-2 rounded-lg border-2 border-border bg-surface text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleAddAdmin()}
              />
              <input
                type="text"
                value={adminNameInput}
                onChange={e => setAdminNameInput(e.target.value)}
                placeholder={t({ de: 'Name (optional)', en: 'Name (optional)' })}
                className="w-40 px-3 py-2 rounded-lg border-2 border-border bg-surface text-sm focus:outline-none focus:border-primary transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleAddAdmin()}
              />
              <button
                onClick={handleAddAdmin}
                disabled={!adminInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={16} />
                {t(labels.adminAddAdmin)}
              </button>
            </div>

            {admins && (
              <div className="space-y-2">
                {/* Seed admins */}
                {admins.seedAdmins.map(userId => (
                  <div
                    key={`seed-${userId}`}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border-2 border-border bg-surface"
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono">{userId}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {t(labels.adminSeedAdmin)}
                      </span>
                    </div>
                    {/* Seed admins cannot be removed */}
                  </div>
                ))}
                {/* Dynamic admins */}
                {admins.dynamicAdmins.map(admin => (
                  <div
                    key={`dyn-${admin.id}`}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl border-2 border-border bg-surface"
                  >
                    <div className="flex items-center gap-2">
                      {admin.name && (
                        <span className="text-sm font-medium">{admin.name}</span>
                      )}
                      <code className="text-sm font-mono text-text-muted">{admin.id}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-primary/15 text-primary">
                        {t(labels.adminDynamicAdmin)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveAdmin(admin.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 font-medium text-xs cursor-pointer hover:bg-red-500/20 transition-colors"
                    >
                      <UserMinus size={14} />
                      {t(labels.adminRemoveAdmin)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <Footer className="mt-8 mb-4" />
      </main>
    </PageLayout>

    {/* Delete confirmation modal */}
    {pendingDelete && (
      <ConfirmModal
        icon={<AlertTriangle size={20} className="text-red-500" />}
        iconBg="bg-red-500/15"
        title={t(labels.adminDeleteConfirm)}
        body={<p>{t({ de: 'Dieser Eintrag wird unwiderruflich gelöscht.', en: 'This entry will be permanently deleted.' })}</p>}
        confirmIcon={<Trash2 size={14} />}
        confirmLabel={t({ de: 'Löschen', en: 'Delete' })}
        confirmVariant="danger"
        cancelLabel={t({ de: 'Abbrechen', en: 'Cancel' })}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    )}

    {/* Block user confirmation modal */}
    {pendingBlock && (
      <ConfirmModal
        icon={<UserX size={20} className="text-amber-500" />}
        iconBg="bg-amber-500/15"
        title={t({ de: 'Benutzer sperren', en: 'Block User' })}
        body={<p>{t({ de: 'Dieser Benutzer wird gesperrt und kann keine Einträge mehr einreichen.', en: 'This user will be blocked from submitting leaderboard entries.' })}<br /><code className="text-xs font-mono mt-1 inline-block">{pendingBlock}</code></p>}
        confirmIcon={<UserX size={14} />}
        confirmLabel={t({ de: 'Sperren', en: 'Block' })}
        confirmVariant="danger"
        cancelLabel={t({ de: 'Abbrechen', en: 'Cancel' })}
        onCancel={() => setPendingBlock(null)}
        onConfirm={confirmBlock}
      />
    )}

    {/* Remove admin confirmation modal */}
    {pendingRemoveAdmin && (
      <ConfirmModal
        icon={<UserMinus size={20} className="text-red-500" />}
        iconBg="bg-red-500/15"
        title={t({ de: 'Administrator entfernen', en: 'Remove Administrator' })}
        body={<p>{t({ de: 'Dieser Benutzer verliert Administratorrechte.', en: 'This user will lose administrator privileges.' })}<br /><code className="text-xs font-mono mt-1 inline-block">{pendingRemoveAdmin}</code></p>}
        confirmIcon={<UserMinus size={14} />}
        confirmLabel={t({ de: 'Entfernen', en: 'Remove' })}
        confirmVariant="danger"
        cancelLabel={t({ de: 'Abbrechen', en: 'Cancel' })}
        onCancel={() => setPendingRemoveAdmin(null)}
        onConfirm={confirmRemoveAdmin}
      />
    )}
    </>
  )
}
