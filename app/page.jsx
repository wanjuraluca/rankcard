import ParticlesBackground from "./components/ParticlesBackground";

export default function Home() {
  return <main className="bg-background min-h-screen relative">
    <ParticlesBackground />
    <nav className= "flex justify-between px-8 py-6 items-center border-line border-b-3"> 
      <a href ="/" className="flex items-center gap-8">
      <img src="/Icons/Logo.png" alt="RankCard Logo" className="pl-1 h-8 scale-350"></img> 
      <span>RankCard</span>
      </a>
    <div className= "flex gap-3 items-center">
      <a className= "text-text-secondary hover:text-white transition-colors duration-350" href="/auth">Sign In</a>
      <a className= "bg-accent text-black font-bold px-4 py-2 rounded-lg" href= "/auth">Get started</a>
    </div>
    </nav>
    <section className= "flex flex-col items-center text-center px-8 pt-32">
      <span className="text-accent text-sm bg-black/20 font-bold border border-line rounded-3xl p-2">• For competitive gamers</span>
      <h1 className="text-6xl text-white font-bold">
        All your ranks. <span className="block text-6xl font-bold text-[#b16cff]"> One profile.</span>
        </h1>
      <p className = "text-text-secondary max-w-lg pt-7">Connect League, Valorant and CS2 — RankCard pulls your real ranks into one clean, shareable profile and gives you deep insights into your overall performance.</p>
      <div className = "items-center flex gap-4 pt-10">
      <a className = "shadow-[0_0_30px_rgba(177,108,255,0.5)] bg-accent text-black font-bold px-4 py-2 rounded-lg" href= "/auth">Create your profile</a>
      <a className = "border-line border-2 text-white font-bold px-4 py-2 rounded-lg" href = "/Luca">View live example</a>
      </div>
      </section>
  </main>;
}