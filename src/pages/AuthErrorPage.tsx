import { useLocation } from 'wouter'
import { useLanguage } from '../context/LanguageContext'
import { PageLayout } from '../components/PageLayout'
import { Footer } from '../components/Footer'
import { LoginButtons } from '../components/LoginButtons'
import { ShieldX, ArrowLeft } from 'lucide-react'

export function AuthErrorPage() {
  const { t } = useLanguage()
  const [, navigate] = useLocation()

  return (
    <PageLayout>
      <main id="main-content" className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="text-center py-16 page-enter">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/15 mb-6">
            <ShieldX className="text-red-500" size={40} />
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-3">
            {t({ de: 'Anmeldung fehlgeschlagen', en: 'Authentication Failed' })}
          </h1>

          <p className="text-text-muted max-w-md mx-auto mb-8 leading-relaxed">
            {t({
              de: 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
              en: 'Sign-in could not be completed. Please try again.',
            })}
          </p>

          <div className="space-y-4">
            <LoginButtons />

            <div>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                {t({ de: 'Zurück zur Startseite', en: 'Back to start' })}
              </button>
            </div>
          </div>
        </div>
        <Footer className="mt-8 mb-4" />
      </main>
    </PageLayout>
  )
}
