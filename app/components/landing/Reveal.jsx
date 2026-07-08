"use client"

import { useEffect, useRef, useState } from "react"

// Scroll-reveal wrapper. The element renders fully visible on the server, and
// only gets hidden on the client if it is still below the viewport at mount —
// so above-the-fold content never flashes (the reason entry fades were removed
// once before) and everything works without JS.
export default function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null)
  const [phase, setPhase] = useState("static") // static | hidden | shown

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.92) return

    setPhase("hidden")
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPhase("shown")
        observer.disconnect()
      }
    }, { rootMargin: "0px 0px -8% 0px" })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${className} ${
        phase === "hidden" ? "opacity-0 translate-y-6" : ""
      } ${
        phase === "shown" ? "opacity-100 translate-y-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.22,1,.36,1)]" : ""
      }`}
      style={phase === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
