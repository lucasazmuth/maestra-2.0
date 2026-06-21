import React from 'react';
import { Pause } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative h-screen min-h-[600px] w-full bg-black overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video 
          src="https://stream.mux.com/TXITBJlLBE0100HhsnSUxPcOvsD46JrJ00YaDtmcyn2M8Y.m3u8?t=0.001&max_resolution=720p"
          poster="https://image.mux.com/TXITBJlLBE0100HhsnSUxPcOvsD46JrJ00YaDtmcyn2M8Y/thumbnail.jpg?time=.001&width=1600"
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-60"
        />
      </div>
      
      <div className="relative z-10 h-full flex flex-col justify-between px-6 md:px-12 lg:px-24 pt-32 pb-12">
        <div className="max-w-3xl mt-12">
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Where your music <br /> is everything
          </h1>
          <p className="text-xl md:text-2xl text-white font-medium max-w-2xl">
            Develop your fanbase, build your business, and create the world around your music.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <div className="flex justify-end">
            <button className="w-10 h-10 rounded-full border border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors">
              <Pause size={16} fill="currentColor" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-white/30 pt-6">
            {[
              { title: 'Amplify your music', href: '#amplify' },
              { title: 'Connect with fans', href: '#connect' },
              { title: 'Grow your business', href: '#grow' },
              { title: 'Understand your audience', href: '#understand' }
            ].map((link, i) => (
              <a key={i} href={link.href} className="group block">
                <h3 className="text-white text-xl font-bold group-hover:text-gray-300 transition-colors">
                  {link.title}
                </h3>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};