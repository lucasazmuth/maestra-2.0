import React from 'react';
import MessageBar from '../components/MessageBar';
import Header from '../components/Header';
import CookieBanner from '../components/CookieBanner';
import Hero from '../components/Hero';
import FeaturesTable from '../components/FeaturesTable';
import PaymentFeatures from '../components/PaymentFeatures';
import Plans from '../components/Plans';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-black font-sans text-white">
      <MessageBar />
      <Header />
      <main>
        <Hero />
        <FeaturesTable />
        <PaymentFeatures />
        <Plans />
        <FAQ />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
};

export default Home;