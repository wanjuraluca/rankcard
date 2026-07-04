import ParticlesBackground from "./components/ParticlesBackground";
import Footer from "./components/Footer";
import NavAuth from "./components/NavAuth";
import { Link2, Trophy, Share2, ShieldCheck, RefreshCw, Ban, Star } from "lucide-react";
import { platformConfig } from "@/lib/platforms";
import { supabase } from "@/lib/supabase";
import { extractGameStats, average } from "@/lib/gameStats";

const SHOWCASE_USERNAME = "DinDjarin"

async function getCachedData(accountId) {
  const { data } = await supabase
    .from("account_cache")
    .select("data")
    .eq("account_id", accountId)
    .maybeSingle()
  return data?.data ?? {}
}

// The landing page preview is a real, live profile (not a hardcoded mock) so
// visitors trust the numbers — see design audit item "fake preview mock".
// Reads from the same account_cache table the /api/card and /api/badge
// routes use, so no live Riot/Valorant API calls happen on page load.
async function getShowcaseProfile() {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, avatar_url, is_pro")
    .eq("username", SHOWCASE_USERNAME)
    .maybeSingle()

  if (!profile) return null

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("id, platform, platform_username, platform_tag")
    .eq("user_id", profile.user_id)

  const accountList = accounts ?? []
  const statsList = await Promise.all(
    accountList.map(async (account) => {
      const apiData = await getCachedData(account.id)
      return { account, stats: extractGameStats(account.platform, apiData) }
    })
  )

  return {
    profile,
    games: statsList.map(({ account, stats }) => ({ account, stats })),
    avgRankScore: average(statsList.map(s => s.stats?.rankScore)),
    avgWinRate: average(statsList.map(s => s.stats?.winRate)),
    avgKda: average(statsList.map(s => s.stats?.kda)),
  }
}

const steps = [
  { number: "01", icon: Link2, title: "Connect your accounts", body: "Link League, TFT, Valorant, CS2, Overwatch and Marvel Rivals in seconds." },
  { number: "02", icon: Trophy, title: "See your true rank", body: "One overall score across every game you play." },
  { number: "03", icon: Share2, title: "Share one link", body: "A public profile you can drop anywhere." },
]

const trustPoints = [
  { icon: ShieldCheck, title: "Straight from Riot", body: "Every rank comes directly from the official Riot Games API — the same source the game itself uses." },
  { icon: RefreshCw, title: "Always up to date", body: "Your card syncs in the background whenever you play. No manual updates, ever." },
  { icon: Ban, title: "No self-reporting", body: "There's no field to type in a rank. What you see is what the API returns — nothing more." },
]

const faqs = [
  { q: "Is RankCard free?", a: "Yes. Creating a profile and connecting your accounts is completely free. Pro adds cosmetic extras like custom themes and per-game cards — never your rank data itself." },
  { q: "Where do the ranks come from?", a: "Directly from the official Riot Games API. We never let you type in or edit a rank — it's pulled straight from the same source the games themselves use." },
  { q: "How often does my card update?", a: "Automatically, in the background. Whenever you play a ranked game, your rank and stats sync without you having to do anything." },
  { q: "Can I remove a connected account?", a: "Any time, from your profile. Removing an account immediately removes its stats from your public card too." },
  { q: "Which games are supported?", a: "League of Legends, TFT, Valorant, CS2, Overwatch and Marvel Rivals today, with more competitive games planned." },
]

export default async function Home() {
  const showcase = await getShowcaseProfile()

  return <main className="bg-background min-h-screen relative">
    <nav className="flex justify-between px-4 sm:px-8 py-5 sm:py-6 items-center border-hairline border-b-3">
      <a href="/" className="flex items-center gap-2 sm:gap-3">
        <img src="/Icons/LogoSmall.png" alt="RankCard Logo" className="h-7 sm:h-8 w-auto"></img>
        <span className="font-bold sm:font-normal">RankCard</span>
      </a>
      <div className="flex gap-2 sm:gap-3 items-center">
        <NavAuth />
      </div>
    </nav>

    <div className="relative overflow-hidden">
      <ParticlesBackground />

    <section className="relative flex flex-col items-center text-center px-4 sm:px-8 pt-20 sm:pt-32 pb-16 sm:pb-24">
      <div className="relative z-10 flex flex-col items-center pointer-events-none">
        <span className="text-accent text-xs sm:text-sm bg-black/20 font-bold border border-hairline rounded-full px-3 py-2">• For competitive gamers</span>
        <h1 className="text-4xl sm:text-6xl text-white font-bold mt-4 leading-tight">
          All your ranks. <span className="block text-4xl sm:text-6xl font-bold text-accent">One profile.</span>
        </h1>
        <p className="text-text-secondary max-w-lg pt-5 sm:pt-7 text-sm sm:text-base px-2">Connect League, TFT, Valorant, CS2, Overwatch and Marvel Rivals — RankCard pulls your real ranks into one clean, shareable profile and gives you deep insights into your overall performance.</p>
        <div className="items-center flex flex-col sm:flex-row gap-3 sm:gap-4 pt-8 sm:pt-10 pb-12 sm:pb-16 w-full sm:w-auto px-4 sm:px-0">
          <a className="pointer-events-auto w-full sm:w-auto text-center shadow-[0_0_30px_rgba(177,108,255,0.5)] bg-accent text-black font-bold px-5 py-3 rounded-lg hover:text-white active:scale-95 transition-all duration-150" href="/auth">Create your profile</a>
          <a className="pointer-events-auto w-full sm:w-auto text-center border-hairline border-2 text-white font-bold px-5 py-3 rounded-lg hover:bg-accent hover:text-black hover:border-accent active:scale-95 transition-all duration-150" href="/DinDjarin">View live example</a>
        </div>
      </div>

      {/* How it works */}
      <div className="relative z-10 flex flex-col items-center pointer-events-none mb-8 sm:mb-10">
        <span className="text-text-muted text-xs sm:text-sm font-bold uppercase tracking-widest">How it works</span>
        <h2 className="text-2xl sm:text-4xl text-white font-bold mt-3 text-center">
          Three steps to one link for every game.
        </h2>
      </div>
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-5xl pointer-events-none">
        {steps.map((step) => (
          <div key={step.number} className="bg-surface border border-hairline rounded-2xl p-6 sm:p-10 text-left min-h-0 sm:min-h-48">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <div className="w-12 h-12 rounded-lg bg-accent/10 border border-hairline flex items-center justify-center flex-shrink-0">
                <step.icon size={22} className="text-accent" />
              </div>
              <span className="text-accent/50 text-2xl sm:text-3xl font-extrabold">{step.number}</span>
            </div>
            <p className="text-text-primary font-semibold text-xl sm:text-2xl mb-2 sm:mb-3">{step.title}</p>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Trust */}
    <section className="relative z-10 px-4 sm:px-8 py-16 sm:py-20 flex flex-col items-center">
      <span className="text-text-muted text-xs sm:text-sm font-bold uppercase tracking-widest">Why the ranks are real</span>
      <h2 className="text-2xl sm:text-4xl text-white font-bold mt-3 text-center max-w-2xl">
        Not self-reported. Not editable. Just your real rank.
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-5xl mt-10 sm:mt-12">
        {trustPoints.map((point) => (
          <div key={point.title} className="bg-surface border border-hairline rounded-2xl p-6 text-left">
            <div className="w-12 h-12 rounded-lg bg-accent/10 border border-hairline mb-4 flex items-center justify-center">
              <point.icon size={20} className="text-accent" />
            </div>
            <p className="text-text-primary font-semibold text-lg mb-1.5">{point.title}</p>
            <p className="text-text-secondary text-sm leading-relaxed">{point.body}</p>
          </div>
        ))}
      </div>
    </section>

    {/* Profile Preview */}
    <section className="relative z-10 px-4 sm:px-8 py-16 sm:py-24 flex flex-col items-center">
      <span className="text-accent text-xs sm:text-sm font-bold uppercase tracking-widest">See it in action</span>
      <h2 className="text-2xl sm:text-4xl text-white font-bold mt-3 text-center">
        This is what your link looks like.
      </h2>
      <p className="text-text-secondary text-sm sm:text-base mt-3 text-center max-w-md">
        Real ranks, real stats, one link you can drop in your bio or Discord.
      </p>

      <a
        href={showcase ? `/${showcase.profile.username}` : "/DinDjarin"}
        className="relative mt-10 sm:mt-12 w-full max-w-2xl rounded-2xl border border-accent/30 bg-surface shadow-2xl overflow-hidden block hover:border-accent/50 transition-colors"
      >
        <div className="h-24 sm:h-28 bg-[radial-gradient(ellipse_55%_130%_at_20%_60%,rgba(177,108,255,0.45),transparent_60%)]" />
        <div className="p-4 sm:p-6 -mt-10 sm:-mt-12">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {showcase?.profile.avatar_url ? (
                <img src={showcase.profile.avatar_url} alt={showcase.profile.username} className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg border-4 border-accent object-cover" />
              ) : (
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-lg border-4 border-accent bg-gradient-to-br from-[#2a2440] to-[#161320] text-xl sm:text-2xl font-bold text-accent">
                  {(showcase?.profile.username ?? "Y")[0].toUpperCase()}
                </div>
              )}
              {showcase?.profile.is_pro && (
                <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent text-black">
                  <Star size={12} fill="currentColor" />
                </span>
              )}
            </div>
            <div className="mt-8 sm:mt-10">
              <span className="text-lg sm:text-xl font-extrabold text-white">{showcase?.profile.username ?? "DinDjarin"}</span>
              <p className="font-mono text-xs text-text-secondary">rankcard.app/{showcase?.profile.username ?? "DinDjarin"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
            {[
              { value: showcase?.avgRankScore != null ? Math.round(showcase.avgRankScore).toLocaleString() : "—", label: "Rank Score", accent: true },
              { value: showcase?.avgWinRate != null ? `${Math.round(showcase.avgWinRate)}%` : "—", label: "Avg Win Rate" },
              { value: showcase?.avgKda != null ? showcase.avgKda.toFixed(2) : "—", label: "Avg KDA" },
              { value: String(showcase?.games.length ?? 0), label: "Games Connected" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-lg p-3 border ${stat.accent ? "border-accent/40 bg-accent-tint" : "border-hairline bg-surface-deep"}`}>
                <p className={`text-lg sm:text-xl font-extrabold ${stat.accent ? "text-accent" : "text-white"}`}>{stat.value}</p>
                <p className="text-text-secondary text-[11px]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
            {(showcase?.games ?? []).map(({ account, stats }) => {
              const config = platformConfig[account.platform]
              if (!config) return null
              return (
                <div key={account.id} className="rounded-lg border border-hairline bg-surface-deep p-3" style={{ borderTopWidth: 3, borderTopColor: config.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="rounded-lg flex items-center justify-center" style={{ width: 24, height: 26, backgroundColor: `${config.color}24`, border: `1px solid ${config.color}66` }}>
                      {config.imageUrl ? (
                        <img src={config.imageUrl} width="12" height="12" style={{ transform: `scale(${config.logoScale ?? 1})` }} alt={config.shortName} />
                      ) : (
                        <svg role="img" viewBox="0 0 24 24" width="12" height="12" fill={config.color}>
                          <path d={config.icon.path} fillRule={config.icon.fillRule ?? "nonzero"} />
                        </svg>
                      )}
                    </div>
                    <span className="text-text-primary text-[11px] font-bold">{config.shortName}</span>
                  </div>
                  <p className="text-white text-sm font-bold">{stats?.tierLabel ?? "Unranked"}</p>
                  <p className="text-text-secondary text-[10px] font-mono">{stats?.winRate != null ? `${Math.round(stats.winRate)}% WR` : "—"}</p>
                </div>
              )
            })}
          </div>
        </div>
      </a>

      <a
        className="mt-10 shadow-[0_0_30px_rgba(177,108,255,0.5)] bg-accent text-black font-bold px-6 py-3 rounded-lg hover:text-white active:scale-95 transition-all duration-150"
        href="/auth"
      >
        Create your profile
      </a>
    </section>

    {/* FAQ */}
    <section className="relative z-10 px-4 sm:px-8 py-16 sm:py-20 flex flex-col items-center">
      <span className="text-text-muted text-xs sm:text-sm font-bold uppercase tracking-widest">FAQ</span>
      <h2 className="text-2xl sm:text-4xl text-white font-bold mt-3 mb-10 sm:mb-12 text-center">
        Questions? Answered.
      </h2>
      <div className="w-full max-w-2xl flex flex-col gap-3">
        {faqs.map((faq) => (
          <details key={faq.q} className="group bg-surface border border-hairline rounded-2xl px-5 py-4">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-4 text-text-primary font-semibold text-sm sm:text-base">
              {faq.q}
              <span className="text-accent text-lg leading-none flex-shrink-0 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="text-text-secondary text-sm leading-relaxed mt-3">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
    </div>

    <Footer />
  </main>;
}
