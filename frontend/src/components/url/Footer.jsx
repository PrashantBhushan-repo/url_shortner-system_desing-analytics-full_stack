import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-8 bg-black text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
        <Link to="/" className="flex items-center hover:opacity-90 transition-opacity">
          <span className="font-extrabold tracking-tight text-white text-base">
            pb<span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">Urls</span>
          </span>
        </Link>
        <p className="text-slate-400 font-medium">© 2026 pbUrls. Built by Viswa &amp; Prashant.</p>
      </div>
    </footer>
  );
}

export default Footer;
