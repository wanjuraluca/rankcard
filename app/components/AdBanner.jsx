"use client"

import { useEffect, useRef } from "react"

export default function AdBanner({ slot, className = "" }) {
    const insRef = useRef(null)
    const pushed = useRef(false)

    useEffect(() => {
        if (pushed.current) return
        pushed.current = true
        try {
            ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        } catch {
            // AdSense script not ready yet or blocked (e.g. ad blocker) — safe to ignore
        }
    }, [])

    return (
        <ins
            ref={insRef}
            className={`adsbygoogle block ${className}`}
            style={{ display: "block" }}
            data-ad-client="ca-pub-6448981035028851"
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
        />
    )
}
