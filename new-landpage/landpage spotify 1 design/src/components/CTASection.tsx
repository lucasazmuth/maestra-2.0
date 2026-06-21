import React from 'react';

export const CTASection: React.FC = () => {
  return (
    <section className="bg-[#4A00E0] text-white py-32 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to claim your artist profile?</h2>
        <p className="text-xl mb-10">Use a Spotify account to get access to Spotify for Artists.</p>
        <a 
          href="/get-started" 
          className="inline-block bg-white text-black font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform text-lg"
        >
          Get started
        </a>
      </div>
    </section>
  );
};