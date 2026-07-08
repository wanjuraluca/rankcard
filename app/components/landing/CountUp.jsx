"use client"

import { useEffect, useRef, useState } from "react"

// Counts a stat up when it scrolls into view. Server-renders the final value
// so the real number is always there without JS; the count-up only kicks in
// for elements still below the fold at mount (same no-flash rule as Reveal).
export default function CountUp({ value, decimals = 0, suffix = "", localize = false }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(null)

  const format = (n) => {
    const rounded = decimals ? n.toFixed(decimals) : Math.round(n)
    return (localize ? Number(rounded).toLocaleString() : String(rounded)) + suffix
  }

  useEffect(() => {
    const el = ref.current
    if (!el || typeof value !== "number") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (el.getBoundingClientRect().top <= window.innerHeight) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const duration = 1100
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        setDisplay(format(value * eased))
        if (t < 1) requestAnimationFrame(tick)
      }
      setDisplay(format(0))
      requestAnimationFrame(tick)
    }, { threshold: 0.6 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  if (typeof value !== "number") return <span>{value}</span>
  return <span ref={ref} className="tabular-nums">{display ?? format(value)}</span>
}
