import React from 'react';
import { Play } from 'lucide-react';

export const FeaturesIntro: React.FC = () => {
  return (
    <section className="bg-black text-white py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="text-sm font-bold tracking-widest uppercase mb-4 block text-gray-400">FEATURES</span>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Tools built for your music</h2>
          <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
            Grow your career while keeping your music at the center. With Spotify for Artists, you can amplify your reach, serve up videos, build pre-release hype, and sell merch and tickets – right where streaming happens.
          </p>
        </div>
        <div className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer">
          <img 
            src="https://img.youtube.com/vi/yYwYpaH1cy0/hqdefault.jpg" 
            alt="Video thumbnail" 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg">
              <Play size={24} fill="currentColor" className="ml-1" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};