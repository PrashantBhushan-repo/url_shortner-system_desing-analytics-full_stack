import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import UrlForm from "../components/UrlForm";
import Features from "../components/Features";
import StatsCard from "../components/StatsCard";
import Footer from "../components/Footer";

function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Hero />
      <UrlForm />
      <StatsCard />
      <Features />
      <Footer />
    </div>
  );
}

export default Home;