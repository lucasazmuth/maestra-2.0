import React from 'react';
import { Instagram, Twitter, Facebook, Globe } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white pt-20 pb-10 px-4 md:px-8">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-8 mb-20">
          
          <div className="md:col-span-1">
            <a href="#" className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.44-.48.18-1.02-.06-1.14-.54-.12-.48.06-1.02.54-1.14 4.26-1.26 9.6-1.02 13.38 1.26.42.24.6.84.3 1.26zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span className="text-2xl font-bold tracking-tighter">Spotify</span>
            </a>
          </div>

          <div className="md:col-span-1">
            <h2 className="text-[#a7a7a7] font-bold text-xs uppercase tracking-widest mb-4">Empresa</h2>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Sobre</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Empregos</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">For the Record</a></li>
            </ul>
          </div>

          <div className="md:col-span-1">
            <h2 className="text-[#a7a7a7] font-bold text-xs uppercase tracking-widest mb-4">Comunidades</h2>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Para Artistas</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Desenvolvedores</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Publicidade</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Investidores</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Fornecedores</a></li>
            </ul>
          </div>

          <div className="md:col-span-1">
            <h2 className="text-[#a7a7a7] font-bold text-xs uppercase tracking-widest mb-4">Links úteis</h2>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Suporte</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Player da Web</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Aplicativo móvel grátis</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Importar suas músicas</a></li>
            </ul>
          </div>

          <div className="md:col-span-1">
            <h2 className="text-[#a7a7a7] font-bold text-xs uppercase tracking-widest mb-4">Planos do Spotify</h2>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Premium Individual</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Premium Duo</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Premium Família</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Premium Universitário</a></li>
              <li><a href="#" className="hover:text-[#1ed760] transition-colors">Spotify Free</a></li>
            </ul>
          </div>

          <div className="md:col-span-1 flex gap-4 md:justify-end">
            <a href="#" className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center hover:bg-[#333] transition-colors">
              <Instagram size={20} />
            </a>
            <a href="#" className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center hover:bg-[#333] transition-colors">
              <Twitter size={20} />
            </a>
            <a href="#" className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center hover:bg-[#333] transition-colors">
              <Facebook size={20} />
            </a>
          </div>

        </div>

        <div className="flex justify-end mb-4">
          <a href="#" className="flex items-center gap-2 text-xs text-[#a7a7a7] hover:text-[#1ed760] transition-colors">
            <Globe size={14} />
            Brasil (Português)
          </a>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-4 border-t border-[#222] text-xs text-[#a7a7a7]">
          <ul className="flex flex-wrap gap-4 mb-4 md:mb-0">
            <li><a href="#" className="hover:text-[#1ed760] transition-colors">Legal</a></li>
            <li><a href="#" className="hover:text-[#1ed760] transition-colors">Segurança e Centro de privacidade</a></li>
            <li><a href="#" className="hover:text-[#1ed760] transition-colors">Política de privacidade</a></li>
            <li><a href="#" className="hover:text-[#1ed760] transition-colors">Cookies</a></li>
            <li><a href="#" className="hover:text-[#1ed760] transition-colors">Sobre anúncios</a></li>
            <li><a href="#" className="hover:text-[#1ed760] transition-colors">Acessibilidade</a></li>
          </ul>
          <span>© 2026 Spotify AB</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;