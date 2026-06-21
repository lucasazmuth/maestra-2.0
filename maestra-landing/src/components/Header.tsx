import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { loginUrl, signupUrl } from '../config';

const NAV = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Planos', href: '#planos' },
  { label: 'FAQ', href: '#faq' },
];

export const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'border-b border-transparent'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 py-4">
        <a href="#top" className="text-white">
          <Logo />
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:gap-5">
          <a href={loginUrl} className="hidden sm:inline text-sm font-bold text-white hover:text-gray-300 transition-colors">
            Entrar
          </a>
          <a
            href={signupUrl}
            className="bg-[#af2896] text-white text-sm font-bold py-2.5 px-5 md:px-6 rounded-full hover:bg-[#c13fa8] transition-colors"
          >
            Começar grátis
          </a>
        </div>
      </div>
    </header>
  );
};
