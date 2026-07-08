function Navbar() {
  return (
    <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto h-16 px-6 flex items-center justify-between">
        <span className="text-xl font-bold text-white tracking-tight">SnapURL</span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-slate-300 hover:text-white transition"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}

export default Navbar;
