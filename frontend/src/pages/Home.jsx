import Navbar from "../components/url/Navbar";
import Hero from "../components/url/Hero";
import UrlForm from "../components/url/UrlForm";
import Footer from "../components/url/Footer";

function Home() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white antialiased selection:bg-blue-500 selection:text-white">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero & Form Section */}
        <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-20">
          {/* Glowing backdrops */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8">
            <Hero />
            
            {/* Shortener Container */}
            <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/40 p-6 md:p-8 backdrop-blur-md shadow-2xl relative">
              <UrlForm />
            </div>
          </div>
        </section>

        {/* Features Matrix Section */}
        <section className="border-t border-white/5 bg-slate-950 py-20">
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs uppercase tracking-[0.25em] text-blue-400 font-bold">Platform Capabilities</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Built for Performance and Precision</h2>
              <p className="text-slate-400 text-sm">Every feature is designed to keep redirects fast and metrics highly accurate.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6 space-y-4 hover:border-blue-500/30 hover:bg-slate-900/50 transition duration-200">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 font-bold text-sm">01</div>
                <h3 className="font-bold text-lg text-white">Widescreen Live Analytics</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Visualize click volume timeseries, geo-locations, browsers, and platform operating systems in real-time. Features live websocket click feeds.</p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6 space-y-4 hover:border-indigo-500/30 hover:bg-slate-900/50 transition duration-200">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-bold text-sm">02</div>
                <h3 className="font-bold text-lg text-white">Customizable QR Engines</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Instantly compile high-fidelity QR Code vectors with custom shapes, corners, rings, and colors. Includes automatic safety contrast-checkers.</p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6 space-y-4 hover:border-emerald-500/30 hover:bg-slate-900/50 transition duration-200">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 font-bold text-sm">03</div>
                <h3 className="font-bold text-lg text-white">Asynchronous Ingestion Pipeline</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Built with BullMQ and separate worker processes. Redirects stay lightning-fast because metrics extraction is decoupled from request threads.</p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6 space-y-4 hover:border-amber-500/30 hover:bg-slate-900/50 transition duration-200">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400 font-bold text-sm">04</div>
                <h3 className="font-bold text-lg text-white">Link Health Monitoring</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Automated bots scan your target long URLs every 6 hours, marking links offline after 3 consecutive failures to protect your reputation.</p>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6 space-y-4 hover:border-purple-500/30 hover:bg-slate-900/50 transition duration-200">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 font-bold text-sm">05</div>
                <h3 className="font-bold text-lg text-white">Spam & Bot Protection</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Blocks statistics poisoning by filtering automated search engine crawlers and implementing rate-limiting sliding windows in Redis.</p>
              </div>

              {/* Feature 6 */}
              <div className="rounded-2xl border border-white/5 bg-slate-900/30 p-6 space-y-4 hover:border-pink-500/30 hover:bg-slate-900/50 transition duration-200">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400 font-bold text-sm">06</div>
                <h3 className="font-bold text-lg text-white">CSV Data Export</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Stream your raw click analytics logs straight into standard CSV spreadsheets for custom business reporting and database analysis.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Home;
