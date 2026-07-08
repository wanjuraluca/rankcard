"use client"

import { useEffect, useRef, useState } from "react"

// Tweens toward `value` whenever it changes — profile stats stream in one
// account at a time, so the averages visibly settle instead of jumping.
// Starts from 0 on first render (mount is the interesting reveal moment)
// and from the previous value on later updates.
export default function AnimatedNumber({ value, decimals = 0, suffix = "", localize = false }) {
  const [display, setDisplay] = useState(null)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  const format = (n) => {
    const rounded = decimals ? n.toFixed(decimals) : Math.round(n)
    return (localize ? Number(rounded).toLocaleString("en-US") : String(rounded)) + suffix
  }

  useEffect(() => {
    if (typeof value !== "number") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = value
      setDisplay(format(value))
      return
    }

    const from = fromRef.current
    fromRef.current = value
    const start = performance.now()
    const duration = 800
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(format(from + (value - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, decimals, suffix, localize])

  if (typeof value !== "number") return <span>{value ?? "—"}</span>
  return <span className="tabular-nums">{display ?? format(0)}</span>
}
