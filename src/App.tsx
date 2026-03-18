import { useEffect, useCallback } from 'react'
import { Route, Switch, Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { ExamProvider, useExam } from './context/ExamContext'
import { StartPage } from './pages/StartPage'
import { QuestionPage } from './pages/QuestionPage'
import { ResultsPage } from './pages/ResultsPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { loadQuestions } from './data/questionLoader'
import { useLanguage } from './context/LanguageContext'
import { labels } from './utils/labels'
import { Loader2 } from 'lucide-react'

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

      <Switch>
        <Route path="/">
          <StartPage onRefresh={() => doLoad(true)} />
        </Route>
        <Route path="/question/:number" component={QuestionPage} />
        <Route path="/results" component={ResultsPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route>
          <StartPage onRefresh={() => doLoad(true)} />
        </Route>
      </Switch>
    </>
  )
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <ThemeProvider>
        <LanguageProvider>
          <ExamProvider>
            <AppContent />
          </ExamProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Router>
  )
}
