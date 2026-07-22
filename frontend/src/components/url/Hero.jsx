function Hero() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 rounded-full text-blue-400">
          Enterprise Grade Redirect Platform
        </span>
      </div>
      <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
        Shorten Links. <br className="hidden sm:inline" />
        <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500 bg-clip-text text-transparent">Measure Performance.</span>
      </h1>
      <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
        SnapURL is a high-speed redirection tool featuring real-time WebSockets analytics, automated destination health pings, and high-fidelity customizable QR Codes.
      </p>
    </div>
  );
}

export default Hero;
