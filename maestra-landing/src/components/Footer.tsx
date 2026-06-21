import React from 'react';
import { Instagram } from 'lucide-react';
import { Logo } from './Logo';
import { loginUrl, signupUrl } from '../config';

export const Footer: React.FC = () => (
  <footer className="bg-black text-white border-t border-white/10 pt-14 pb-10 px-5 md:px-8">
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
        <div className="max-w-xs">
          <Logo />
          <p className="text-sm text-gray-400 leading-relaxed mt-4">
            A plataforma que diagnostica, planeja e acompanha a sua carreira na música.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Produto</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#recursos" className="text-gray-300 hover:text-white transition-colors">Recursos</a></li>
              <li><a href="#planos" className="text-gray-300 hover:text-white transition-colors">Planos</a></li>
              <li><a href="#faq" className="text-gray-300 hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Conta</h4>
            <ul className="space-y-3 text-sm">
              <li><a href={loginUrl} className="text-gray-300 hover:text-white transition-colors">Entrar</a></li>
              <li><a href={signupUrl} className="text-gray-300 hover:text-white transition-colors">Criar conta</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Social</h4>
            <a href="#" aria-label="Instagram" className="w-10 h-10 rounded-full bg-white/10 inline-flex items-center justify-center hover:bg-white/20 transition-colors">
              <Instagram size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-white/10 text-sm text-gray-500">
        © {new Date().getFullYear()} Maestra Manager. Todos os direitos reservados.
      </div>
    </div>
  </footer>
);
