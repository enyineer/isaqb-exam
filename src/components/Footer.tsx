import { ExternalLink } from './ExternalLink'
import { useLanguage } from '../context/LanguageContext'
import { labels } from '../utils/labels'
import { Github, Globe } from 'lucide-react'

/**
 * Shared premium footer with disclaimer and author/repo links.
 */
export function Footer({ className = '' }: { className?: string }) {
  const { t } = useLanguage()

  return (
    <footer className={`border-t border-border/50 ${className}`}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Disclaimer */}
        <p className="text-center text-[11px] text-text-muted/50 leading-relaxed max-w-sm mx-auto">
          {t(labels.disclaimer)}
        </p>

        {/* Links */}
        <div className="flex items-center justify-center gap-3">
          <ExternalLink
            href="https://enking.dev"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-surface/30 text-[11px] text-text-muted/60 hover:text-primary hover:border-primary/30 hover:bg-surface transition-all"
          >
            <Globe size={11} />
            enking.dev
          </ExternalLink>
          <ExternalLink
            href="https://github.com/enyineer/isaqb-exam"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-surface/30 text-[11px] text-text-muted/60 hover:text-primary hover:border-primary/30 hover:bg-surface transition-all"
          >
            <Github size={11} />
            GitHub
          </ExternalLink>
        </div>
      </div>
    </footer>
  )
}
