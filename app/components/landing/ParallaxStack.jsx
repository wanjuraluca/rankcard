"use client"

import { useRef } from "react"

// Sets --par-x / --par-y (-1..1) on the wrapper while the pointer moves over
// it; child layers translate by those vars at different depths. Translation
// only, never rotation — tilting the cards makes their small text read as
// blurry at normal zoom (verified earlier with screenshot comparisons).
export default function ParallaxStack({ children, className = "", style }) {
  const ref = useRef(null)

  const handleMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--par-x", ((e.clientX - rect.left) / rect.width - 0.5) * 2)
    el.style.setProperty("--par-y", ((e.clientY - rect.top) / rect.height - 0.5) * 2)
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty("--par-x", 0)
    el.style.setProperty("--par-y", 0)
  }

  return (
    <div ref={ref} className={className} style={style} onPointerMove={handleMove} onPointerLeave={handleLeave}>
      {children}
    </div>
  )
}
