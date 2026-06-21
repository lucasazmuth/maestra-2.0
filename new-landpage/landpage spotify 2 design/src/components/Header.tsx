import React from 'react';
import { Menu } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-black text-white h-20 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <a href="#" className="flex items-center gap-2 hover:text-white transition-colors">
        {/* Spotify Logo Placeholder */}
        <div className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.44-.48.18-1.02-.06-1.14-.54-.12-.48.06-1.02.54-1.14 4.26-1.26 9.6-1.02 13.38 1.26.42.24.6.84.3 1.26zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <span className="text-2xl font-bold tracking-tighter">Spotify</span>
        </div>
      </a>

      <nav className="hidden md:flex items-center gap-8 font-bold text-[15px]">
        <a href="#" className="hover:text-[#1ed760] transition-colors">Planos Premium</a>
        <a href="#" className="hover:text-[#1ed760] transition-colors">Suporte</a>
        <a href="#" className="hover:text-[#1ed760] transition-colors">Baixar</a>
        <div className="w-[1px] h-4 bg-white/60"></div>
        <a href="#" className="text-white/80 hover:text-white transition-colors font-medium">Inscrever-se</a>
        <a href="#" className="text-white/80 hover:text-white transition-colors font-medium">Entrar</a>
      </nav>

      <button className="md:hidden p-2">
        <Menu size={24} />
      </button>
    </header>
  );
};

export default Header;