import { useEffect, useRef, useState } from 'react'

const SPACE_THRESHOLD = 300 // px — minimum gap to enable fixed positioning

interface CardFanPosition {
  /** Pass to the element immediately after the main panel */
  anchorRef: React.RefObject<HTMLDivElement | null>
  /** Pass to the footer element */
  footerRef: React.RefObject<HTMLDivElement | null>
  /**
   * `fixed`  — float at viewport bottom (enough space, footer not visible)
   * `inflow` — sit right below the panel (not enough space)
   */
  mode: 'fixed' | 'inflow'
  /**
   * How many px the card fan should be lifted from the viewport bottom
   * to avoid overlapping the visible portion of the footer.
   */
  bottomOffset: number
}

/**
 * Smart card fan positioning hook.
 *
 * Behaviour:
 * 1. Measures the gap between the anchor (bottom of main panel) and the
 *    viewport bottom. If gap < SPACE_THRESHOLD → `inflow` mode.
 * 2. Uses IntersectionObserver on the footer to calculate how many px
 *    of it are currently visible, then lifts the fixed card fan by
 *    that amount (bottomOffset).
 */
export function useCardFanPosition(): CardFanPosition {
  const anchorRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'fixed' | 'inflow'>('fixed')
  const [bottomOffset, setBottomOffset] = useState(0)

  // ── Gap check (scroll + resize) ──────────────────────────────
  useEffect(() => {
    const checkGap = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const gapToBottom = window.innerHeight - rect.bottom
      setMode(gapToBottom < SPACE_THRESHOLD ? 'inflow' : 'fixed')
    }

    checkGap()
    window.addEventListener('scroll', checkGap, { passive: true })
    window.addEventListener('resize', checkGap, { passive: true })
    return () => {
      window.removeEventListener('scroll', checkGap)
      window.removeEventListener('resize', checkGap)
    }
  }, [])

  // ── Footer intersection → lift offset ────────────────────────
  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setBottomOffset(0)
          return
        }
        // How many px of the footer are currently visible
        const visiblePx =
          entry.boundingClientRect.height * entry.intersectionRatio
        setBottomOffset(visiblePx)
      },
      {
        // Fire at every px change (threshold array 0→1 in fine steps)
        threshold: Array.from({ length: 101 }, (_, i) => i / 100),
      },
    )

    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  return { anchorRef, footerRef, mode, bottomOffset }
}
