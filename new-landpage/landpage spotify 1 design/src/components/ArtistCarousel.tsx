import React from 'react';
import { Play, Volume2, ArrowLeft, ArrowRight } from 'lucide-react';

const artists = [
  { name: 'Anitta', image: 'https://i.scdn.co/image/ab6761610000e5eb03479cd9d2eec574230368d4?stp=dst-jpg_p56x56', poster: 'https://image.mux.com/oBjiH1HmP6Ew5cDGHs3cewPKhPprSekfVvcSd4jGDiY/thumbnail.jpg?width=1600&time=0.001' },
  { name: 'Fana Hues', image: 'https://i.scdn.co/image/ab6761610000e5ebc840bffe9a9c81abbce9e1d0?stp=dst-jpg_p56x56', poster: 'https://image.mux.com/I5l3aoTdpz01MXI02qqlcY3x01oovaZddHFxZZffpSKI6Y/thumbnail.jpg?width=1600&time=0.001' },
  { name: 'Lizzy McAlpine', image: 'https://i.scdn.co/image/ab6761610000e5ebb7e3d5ad48cc67f32a3a0930?stp=dst-jpg_p56x56', poster: 'https://image.mux.com/L01GQFZUVVsyNmlI7dfwvjbeJv02aafYxinISPJ023m02CU/thumbnail.jpg?width=1600&time=0.001' },
  { name: 'UPSAHL', image: 'https://i.scdn.co/image/ab6761610000e5eb631c9afc72085c1cfc50a923?stp=dst-jpg_p56x56', poster: 'https://image.mux.com/q8h9O2rufNjxpUykeax5nfqcEwVMtFLsqjo61U2P9mM/thumbnail.jpg?width=1600&time=0.001' },
  { name: 'Conner Smith', image: 'https://i.scdn.co/image/ab6761610000e5ebe0c9b64e28bed30c90065987?stp=dst-jpg_p56x56', poster: 'https://image.mux.com/UVqxtZRAlZ3pjQ8Zbakyk38pgi5zQhAWzVEYafQ6WpQ/thumbnail.jpg?width=1600&time=0.001' },
];

export const ArtistCarousel: React.FC = () => {
  return (
    <section className="bg-black text-white py-24 overflow-hidden">
      <div className="px-6 md:px-12 lg:px-24 mb-12">
        <h2 className="text-4xl md:text-5xl font-bold">Hear from artists</h2>
      </div>
      
      <div className="relative">
        <div className="flex gap-4 px-6 md:px-12 lg:px-24 overflow-x-auto pb-8 snap-x snap-mandatory hide-scrollbar">
          {artists.map((artist, i) => (
            <div key={i} className="relative flex-none w-[280px] aspect-[9/16] rounded-xl overflow-hidden snap-center group cursor-pointer">
              <img src={artist.poster} alt={artist.name} className="w-full h-full object-cover" />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100" />
              
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <div className="flex gap-4">
                  <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
                    <Play size={20} fill="currentColor" className="ml-1" />
                  </button>
                  <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
                    <Volume2 size={20} />
                  </button>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                <img src={artist.image} alt={artist.name} className="w-8 h-8 rounded-full object-cover" />
                <span className="font-bold text-sm">{artist.name}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4 px-6 md:px-12 lg:px-24 mt-4">
          <button className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <button className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
};