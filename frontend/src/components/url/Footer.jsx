function Footer() {
  return (
    <footer className="border-t border-white/5 py-8 bg-slate-950 text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="bg-slate-900 border border-white/10 w-6 h-6 rounded flex items-center justify-center text-slate-400 font-extrabold text-[10px]">S</span>
          <span className="font-semibold text-slate-400">SnapURL</span>
        </div>
        <p className="text-slate-600">© 2026 SnapURL. Built by Viswa &amp; Prashant.</p>
      </div>
    </footer>
  );
}

export default Footer;
