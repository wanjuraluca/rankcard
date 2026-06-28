import ParticlesBackground from "./components/ParticlesBackground";
import Footer from "./components/Footer";
import { Link2, Trophy, Share2 } from "lucide-react";
import { Analytics } from "@vercel/analytics/next"

export default function Home() {
  <Analytics/>
  return <main className="bg-background min-h-screen relative">
    <nav className="flex justify-between px-4 sm:px-8 py-5 sm:py-6 items-center border-line border-b-3">
      <a href="/" className="flex items-center gap-2 sm:gap-3">
        <img src="/Icons/Logo.png" alt="RankCard Logo" className="h-7 sm:h-8 scale-350"></img>
        <span className="font-bold sm:font-normal">RankCard</span>
      </a>
      <div className="flex gap-2 sm:gap-3 items-center">
        <a className="text-text-secondary hover:text-white active:text-white transition-colors duration-150 px-2" href="/auth">Sign In</a>
        <a className="bg-accent text-black font-bold px-3 sm:px-4 py-2 rounded-lg hover:text-white active:scale-95 transition-all duration-150 text-sm sm:text-base" href="/auth">Get started</a>
      </div>
    </nav>

    <section className="relative min-h-screen overflow-hidden flex flex-col items-center text-center px-4 sm:px-8 pt-20 sm:pt-32 pb-12">
      <ParticlesBackground />
      <div className="relative z-10 flex flex-col items-center pointer-events-none">
        <span className="text-accent text-xs sm:text-sm bg-black/20 font-bold border border-line rounded-3xl px-3 py-2">• For competitive gamers</span>
        <h1 className="text-4xl sm:text-6xl text-white font-bold mt-4 leading-tight">
          All your ranks. <span className="block text-4xl sm:text-6xl font-bold text-[#b16cff]">One profile.</span>
        </h1>
        <p className="text-text-secondary max-w-lg pt-5 sm:pt-7 text-sm sm:text-base px-2">Connect League, Valorant and CS2 — RankCard pulls your real ranks into one clean, shareable profile and gives you deep insights into your overall performance.</p>
        <div className="items-center flex flex-col sm:flex-row gap-3 sm:gap-4 pt-8 sm:pt-10 pb-12 sm:pb-16 w-full sm:w-auto px-4 sm:px-0">
          <a className="pointer-events-auto w-full sm:w-auto text-center shadow-[0_0_30px_rgba(177,108,255,0.5)] bg-accent text-black font-bold px-5 py-3 rounded-lg hover:text-white active:scale-95 transition-all duration-150" href="/auth">Create your profile</a>
          <a className="pointer-events-auto w-full sm:w-auto text-center border-line border-2 text-white font-bold px-5 py-3 rounded-lg hover:bg-[#b16cff] active:bg-[#b16cff] active:scale-95 hover:shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all duration-150" href="/Luca">View live example</a>
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

    <Footer />
  </main>;
}
