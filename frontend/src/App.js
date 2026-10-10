import './App.css';
import { useEffect, useState } from 'react';
import { FormsProvider } from './context/FormsContext';
import Navbar from './components/ckr/Navbar';
import Hero from './components/ckr/Hero';
import Motivation from './components/ckr/Motivation';
import MarketIndex from './components/ckr/MarketIndex';
import Testimonials from './components/ckr/Testimonials';
import BlogCards from './components/ckr/BlogCards';
import AboutMe from './components/ckr/AboutMe';
import NeedAnalysisForms from './components/ckr/NeedAnalysisForms';
import ConsultancyFlow from './components/ckr/ConsultancyFlow';
import ApproachClosing from './components/ckr/ApproachClosing';
import FeedbackForm from './components/ckr/FeedbackForm';
import MelisAssistant from './components/ckr/MelisAssistant';
import Footer from './components/ckr/Footer';
import AdminPanel from './components/ckr/AdminPanel';

const HARBOR = 'https://customer-assets-v7afamib.emergentagent.net/job_canakkale-homes-1/artifacts/3772b21f9b6a5b2f_%C3%87ANAKKALE%20L%C4%B0MAN.png';

function App() {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash === '#admin');

  useEffect(() => {
    const onHashChange = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (isAdmin) {
    return <AdminPanel />;
  }

  return (
    <FormsProvider>
      <div className="App">
        {/* Global fixed background visible through the side gutters */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: `url(${HARBOR})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />

        <Navbar />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Hero />

          {/* Frosted glass content column */}
          <div className="ckr-glass-column">
            <Testimonials />
            <MarketIndex />
            <AboutMe />
            <Motivation />
            <BlogCards />
            <NeedAnalysisForms />
            <ConsultancyFlow />
            <ApproachClosing />
            <FeedbackForm />
          </div>

          <Footer />
        </div>

        <MelisAssistant />
      </div>
    </FormsProvider>
  );
}

export default App;
