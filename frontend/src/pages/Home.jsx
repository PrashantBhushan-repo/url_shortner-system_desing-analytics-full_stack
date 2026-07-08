import Navbar from "../components/url/Navbar";
import Hero from "../components/url/Hero";
import UrlForm from "../components/url/UrlForm";
import Footer from "../components/url/Footer";

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <UrlForm />
      </main>
      <Footer />
    </div>
  );
}

export default Home;
