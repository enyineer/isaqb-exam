import { useEffect, useCallback, lazy, Suspense } from 'react'
import { Route, Switch, Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthContext'
import { ExamProvider, useExam } from './context/ExamContext'
import { StartPage } from './pages/StartPage'
import { loadQuestions } from './data/questionLoader'
import { useLanguage } from './context/LanguageContext'
import { labels } from './utils/labels'
import { Loader2 } from 'lucide-react'

// Lazy-loaded pages — code-split into separate chunks
const QuestionPage = lazy(() => import('./pages/QuestionPage').then(m => ({ default: m.QuestionPage })))
const ResultsPage = lazy(() => import('./pages/ResultsPage').then(m => ({ default: m.ResultsPage })))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
const AuthErrorPage = lazy(() => import('./pages/AuthErrorPage').then(m => ({ default: m.AuthErrorPage })))
const SessionsPage = lazy(() => import('./pages/SessionsPage').then(m => ({ default: m.SessionsPage })))
const SessionDetailPage = lazy(() => import('./pages/SessionDetailPage').then(m => ({ default: m.SessionDetailPage })))
const SessionExamPage = lazy(() => import('./pages/SessionExamPage').then(m => ({ default: m.SessionExamPage })))

/** Minimal spinner shown while a lazy chunk is loading */
function LazyFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={28} />
    </div>
  )
}

function AppContent() {
  const { setQuestions, setDataSource, setFetchedAt, setQuestionsCommitSha, setLoading, loading } = useExam()
  const { t } = useLanguage()

  const doLoad = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    const { questions, source, fetchedAt, commitSha } = await loadQuestions(forceRefresh)
    setQuestions(questions)
    setDataSource(source)
    setFetchedAt(fetchedAt)
    setQuestionsCommitSha(commitSha)
    setLoading(false)
  }, [setQuestions, setDataSource, setFetchedAt, setQuestionsCommitSha, setLoading])

  useEffect(() => {
    doLoad()
  }, [doLoad])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center page-enter">
          <Loader2 className="mx-auto mb-4 animate-spin text-primary" size={40} />
          <p className="font-heading font-semibold text-lg">{t(labels.examTitle)}</p>
          <p className="text-sm text-text-muted mt-1">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        {t(labels.skipToContent)}
      </a>

      <Suspense fallback={<LazyFallback />}>
        <Switch>
          <Route path="/">
            <StartPage onRefresh={() => doLoad(true)} />
          </Route>
          <Route path="/question/:number" component={QuestionPage} />
          <Route path="/results" component={ResultsPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/auth-error" component={AuthErrorPage} />
          <Route path="/sessions" component={SessionsPage} />
          <Route path="/sessions/:id" component={SessionDetailPage} />
          <Route path="/session/:id" component={SessionExamPage} />
          <Route>
            <StartPage onRefresh={() => doLoad(true)} />
          </Route>
        </Switch>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ExamProvider>
              <AppContent />
            </ExamProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  )
}
