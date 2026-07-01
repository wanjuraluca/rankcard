import Link from "next/link"

export default function ProfileNotFound() {
    return (
        <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md text-center">
                {/* Glow badge */}
                <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl border border-line bg-surface">
                        <span className="text-4xl font-extrabold text-accent-soft">404</span>
                    </div>
                </div>

                <h1 className="text-2xl font-extrabold text-text-primary sm:text-3xl">
                    We couldn&apos;t find that profile
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    This RankCard doesn&apos;t exist — the username may have been
                    changed, the profile removed, or the link mistyped.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                        href="/"
                        className="w-full rounded-lg border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:text-white sm:w-auto"
                    >
                        Back to home
                    </Link>
                    <Link
                        href="/auth"
                        className="w-full rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary sm:w-auto"
                    >
                        Create your own RankCard
                    </Link>
                </div>
            </div>
        </main>
    )
}
