import ParticlesBackground from "./components/ParticlesBackground";
import Footer from "./components/Footer";
import NavAuth from "./components/NavAuth";
import { Link2, Trophy, Share2 } from "lucide-react";
import { platformConfig } from "@/lib/platforms";

const previewGames = [
  { platform: "League of Legends", tier: "Diamond II", detail: "78 LP · 61% WR" },
  { platform: "Valorant", tier: "Immortal 1", detail: "312 RR · 58% WR" },
  { platform: "CSGO", tier: "15.2k Elo", detail: "Premier · 54% WR" },
]

export default function Home() {
  return <main className="bg-background min-h-screen relative">
    <nav className="flex justify-between px-4 sm:px-8 py-5 sm:py-6 items-center border-line border-b-3">
      <a href="/" className="flex items-center gap-2 sm:gap-3">
        <img src="/Icons/Logo.png" alt="RankCard Logo" className="h-7 sm:h-8 scale-350"></img>
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
        <span className="text-accent text-xs sm:text-sm bg-black/20 font-bold border border-line rounded-3xl px-3 py-2">• For competitive gamers</span>
        <h1 className="text-4xl sm:text-6xl text-white font-bold mt-4 leading-tight">
          All your ranks. <span className="block text-4xl sm:text-6xl font-bold text-[#b16cff]">One profile.</span>
        </h1>
        <p className="text-text-secondary max-w-lg pt-5 sm:pt-7 text-sm sm:text-base px-2">Connect League, Valorant and CS2 — RankCard pulls your real ranks into one clean, shareable profile and gives you deep insights into your overall performance.</p>
        <div className="items-center flex flex-col sm:flex-row gap-3 sm:gap-4 pt-8 sm:pt-10 pb-12 sm:pb-16 w-full sm:w-auto px-4 sm:px-0">
          <a className="pointer-events-auto w-full sm:w-auto text-center shadow-[0_0_30px_rgba(177,108,255,0.5)] bg-accent text-black font-bold px-5 py-3 rounded-lg hover:text-white active:scale-95 transition-all duration-150" href="/auth">Create your profile</a>
          <a className="pointer-events-auto w-full sm:w-auto text-center border-line border-2 text-white font-bold px-5 py-3 rounded-lg hover:bg-[#b16cff] active:bg-[#b16cff] active:scale-95 hover:shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all duration-150" href="/DinDjarin">View live example</a>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-5xl pointer-events-none">
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-10 text-left min-h-0 sm:min-h-48">
          <div className="w-12 h-12 rounded-lg bg-accent/10 border border-line mb-5 sm:mb-6 flex items-center justify-center">
            <Link2 size={22} className="text-accent" />
          </div>
          <p className="text-text-primary font-semibold text-xl sm:text-2xl mb-2 sm:mb-3">Connect your accounts</p>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">Link League, Valorant and CS2 in seconds.</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-10 text-left min-h-0 sm:min-h-48">
          <div className="w-12 h-12 rounded-lg bg-accent/10 border border-line mb-5 sm:mb-6 flex items-center justify-center">
            <Trophy size={22} className="text-accent" />
          </div>
          <p className="text-text-primary font-semibold text-xl sm:text-2xl mb-2 sm:mb-3">See your true rank</p>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">One overall score across every game you play.</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-10 text-left min-h-0 sm:min-h-48">
          <div className="w-12 h-12 rounded-lg bg-accent/10 border border-line mb-5 sm:mb-6 flex items-center justify-center">
            <Share2 size={22} className="text-accent" />
          </div>
          <p className="text-text-primary font-semibold text-xl sm:text-2xl mb-2 sm:mb-3">Share one link</p>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">A public profile you can drop anywhere.</p>
        </div>
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

      <div className="relative mt-10 sm:mt-12 w-full max-w-2xl rounded-2xl border border-accent/30 bg-surface shadow-[0_0_50px_rgba(177,108,255,0.18)] overflow-hidden">
        <div className="h-24 sm:h-28 bg-[radial-gradient(ellipse_55%_130%_at_20%_60%,rgba(177,108,255,0.45),transparent_60%)]" />
        <div className="p-4 sm:p-6 -mt-10 sm:-mt-12">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-lg border-4 border-accent bg-gradient-to-br from-[#2a2440] to-[#161320] text-xl sm:text-2xl font-bold text-accent">
                Y
              </div>
              <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent text-[11px] font-bold text-black">
                ★
              </span>
            </div>
            <div className="mt-8 sm:mt-10">
              <span className="text-lg sm:text-xl font-extrabold text-white">yourname</span>
              <p className="font-mono text-xs text-text-secondary">rankcard.app/yourname</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
            {[
              { value: "2,847", label: "Rank Score", accent: true },
              { value: "58%", label: "Avg Win Rate" },
              { value: "2.4", label: "Avg KDA" },
              { value: "3", label: "Games Connected" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl p-3 border ${stat.accent ? "border-accent/40 bg-accent-tint" : "border-hairline bg-surface-deep"}`}>
                <p className={`text-lg sm:text-xl font-extrabold ${stat.accent ? "text-accent" : "text-white"}`}>{stat.value}</p>
                <p className="text-text-secondary text-[11px]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
            {previewGames.map((game) => {
              const config = platformConfig[game.platform]
              return (
                <div key={game.platform} className="rounded-xl border border-hairline bg-surface-deep p-3" style={{ borderTopWidth: 3, borderTopColor: config.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="rounded-[7px] flex items-center justify-center" style={{ width: 24, height: 26, backgroundColor: `${config.color}24`, border: `1px solid ${config.color}66` }}>
                      <svg role="img" viewBox="0 0 24 24" width="12" height="12" fill={config.color}>
                        <path d={config.icon.path} fillRule={config.icon.fillRule ?? "nonzero"} />
                      </svg>
                    </div>
                    <span className="text-text-primary text-[11px] font-bold">{config.shortName}</span>
                  </div>
                  <p className="text-white text-sm font-bold">{game.tier}</p>
                  <p className="text-text-secondary text-[10px] font-mono">{game.detail}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <a
        className="mt-10 shadow-[0_0_30px_rgba(177,108,255,0.5)] bg-accent text-black font-bold px-6 py-3 rounded-lg hover:text-white active:scale-95 transition-all duration-150"
        href="/auth"
      >
        Create your profile
      </a>
    </section>
    </div>

    <Footer />
  </main>;
}
