import { useState, useEffect, useRef, type ReactNode } from 'react'

const EXIT_MS = 150
const ENTER_MS = 250

type Phase = 'idle' | 'exiting' | 'entering'

interface PageTransitionProps {
  /** Key that triggers the transition when it changes */
  transitionKey: string
  /** Navigation direction — 'forward' slides right-to-left, 'back' slides left-to-right */
  direction: 'forward' | 'back'
  children: ReactNode
}

/**
 * Animates content transitions with directional slide enter/exit.
 * Sequences the animation: old content exits first, then new content enters.
 * This avoids the visual overlap of simultaneous enter/exit.
 */
export function PageTransition({ transitionKey, direction, children }: PageTransitionProps) {
  const [displayedChildren, setDisplayedChildren] = useState(children)
  const [displayedKey, setDisplayedKey] = useState(transitionKey)
  const [phase, setPhase] = useState<Phase>('idle')
  const [currentDirection, setCurrentDirection] = useState(direction)

  const prevKeyRef = useRef(transitionKey)
  const pendingRef = useRef<{ key: string; children: ReactNode; direction: 'forward' | 'back' } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  // When transitionKey changes → start exit phase
  useEffect(() => {
    if (transitionKey === prevKeyRef.current) return
    prevKeyRef.current = transitionKey

    // Store pending content for after exit completes
    pendingRef.current = { key: transitionKey, children, direction }
    setCurrentDirection(direction)
    setPhase('exiting')

    // After exit animation → swap content and enter
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const pending = pendingRef.current
      if (!pending) return
      setDisplayedChildren(pending.children)
      setDisplayedKey(pending.key)
      setPhase('entering')
      pendingRef.current = null

      // After enter animation → idle
      timeoutRef.current = setTimeout(() => {
        setPhase('idle')
      }, ENTER_MS)
    }, EXIT_MS)

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [transitionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep displayed content fresh when NOT transitioning
  // (e.g. toggling an answer shouldn't require a transition)
  if (phase === 'idle' && transitionKey === displayedKey) {
    // Use a direct assignment instead of setState to avoid extra renders
    // This works because we're in the render phase
    if (displayedChildren !== children) {
      setDisplayedChildren(children)
    }
  }

  const className =
    phase === 'exiting'
      ? (currentDirection === 'forward' ? 'question-exit-left' : 'question-exit-right')
    : phase === 'entering'
      ? (currentDirection === 'forward' ? 'question-enter-forward' : 'question-enter-back')
    : ''

  return (
    <div key={displayedKey} className={className}>
      {displayedChildren}
    </div>
  )
}
