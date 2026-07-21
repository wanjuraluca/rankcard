import TopNav from "./TopNav"
import Footer from "./Footer"
import { Sparkles } from "lucide-react"

/* Rendered on /<username> when no profile owns that name (page.jsx validates
   the pattern first). Instead of a dead 404, the visit becomes a signup
   pitch: whoever followed the link — or typed their own gamertag — sees the
   URL is still free and can claim it on the spot. */
export default function ClaimUsername({ username }) {
    return (
        <>
            <TopNav />
            <div className="p-3 max-w-[1140px] mx-auto">
                <div className="mt-10 sm:mt-20 flex flex-col items-center text-center">
                    <div className="grid h-20 w-20 place-items-center rounded-2xl bg-surface border border-dashed border-accent/50">
                        <span className="text-accent-soft text-3xl font-extrabold">{username.charAt(0).toUpperCase()}</span>
                    </div>

                    <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface border border-hairline px-3.5 py-1.5 text-sm font-mono text-text-secondary">
                        rankcard.app/<span className="text-text-primary font-semibold">{username}</span>
                    </p>

                    <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-text-primary">
                        This RankCard is still <span className="text-accent-soft">free</span>.
                    </h1>
                    <p className="mt-2 max-w-md text-sm text-text-secondary">
                        Nobody has claimed <span className="text-text-primary font-semibold">{username}</span> yet.
                        Connect League, TFT, Valorant, CS2 and more, and turn this link into your shareable rank profile.
                    </p>

                    <a
                        href="/auth"
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all hover:text-white active:scale-95"
                    >
                        <Sparkles size={16} />
                        Claim {username}
                    </a>
                    <p className="mt-3 text-[11px] text-text-secondary">Free · takes a minute · real ranks, straight from each game&apos;s API</p>
                </div>
            </div>
            <Footer />
        </>
    )
}
