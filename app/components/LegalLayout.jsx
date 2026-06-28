export default function LegalLayout({ title, children }) {
    return (
        <div className="relative min-h-screen overflow-hidden bg-background">
            <div
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background:
                        "radial-gradient(680px 520px at 50% -8%, rgba(177,108,255,0.16), transparent 60%)",
                }}
            />
            <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">
                <a href="/" className="mb-10 inline-flex items-center gap-2">
                    <img src="/Icons/LogoSmall.png" className="h-7" />
                    <span className="text-base font-bold text-white">RankCard</span>
                </a>

                <h1 className="text-3xl font-bold text-white">{title}</h1>

                <div className="legal-content mt-8 flex flex-col gap-6 text-sm leading-relaxed text-text-secondary">
                    {children}
                </div>
            </div>
        </div>
    )
}
