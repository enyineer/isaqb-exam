import type { ReactNode, AnchorHTMLAttributes } from 'react'
import { ExternalLink as ExternalLinkIcon } from 'lucide-react'

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: ReactNode
  /** Show an external link icon after the text */
  showIcon?: boolean
}

/**
 * Shared external link — always opens in a new tab with noopener noreferrer.
 * Defaults to `text-primary-light hover:underline` styling; override via className.
 */
export function ExternalLink({ href, children, showIcon = false, className = 'text-primary-light hover:underline', ...rest }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...rest}
    >
      {children}
      {showIcon && <ExternalLinkIcon size={12} className="inline ml-1 opacity-60" />}
    </a>
  )
}
