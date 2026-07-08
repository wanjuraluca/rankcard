"use client"

import { useRef } from "react"

// Card wrapper whose hover glow follows the cursor. The glow itself lives in
// CSS (.spotlight-card::before in globals.css); this only feeds it the
// pointer position via CSS vars.
export default function SpotlightCard({ children, className = "" }) {
  const ref = useRef(null)

  const handleMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`)
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`)
  }

  return (
    <div ref={ref} className={`spotlight-card ${className}`} onPointerMove={handleMove}>
      {children}
    </div>
  )
}
