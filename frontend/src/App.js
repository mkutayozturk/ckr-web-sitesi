import './App.css';
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

function App() {
  return (
    <FormsProvider>
      <div className="App">
        <Navbar />
        <main>
          <Hero />
          <Motivation />
          <MarketIndex />
          <Testimonials />
          <BlogCards />
          <AboutMe />
          <NeedAnalysisForms />
          <ConsultancyFlow />
          <ApproachClosing />
          <FeedbackForm />
        </main>
        <Footer />
        <MelisAssistant />
      </div>
    </FormsProvider>
  );
}

export default App;
