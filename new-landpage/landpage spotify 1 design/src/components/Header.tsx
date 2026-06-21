import React from 'react';
import { Globe } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-transparent transition-colors duration-300 hover:bg-black/80">
      <div className="flex items-center gap-8">
        <a href="/" aria-label="Spotify for Artists" className="text-white">
          <svg viewBox="0 0 113 32" width="113" height="32" fill="currentColor">
            <path d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm7.317 23.066c-.303.496-.93.65-1.426.347-3.904-2.384-8.814-2.923-14.61-.16-.55.26-1.21-.01-1.47-.56-.26-.55.01-1.21.56-1.47 6.33-3.01 11.76-2.4 16.15.28.496.303.65.93.347 1.426zm1.99-4.43c-.38.618-1.166.806-1.784.426-4.45-2.736-11.25-3.54-16.28-1.936-.69.22-1.42-.16-1.64-.85-.22-.69.16-1.42.85-1.64 5.78-1.84 13.28-.95 18.43 2.216.618.38.806 1.166.426 1.784zm.14-4.59c-5.33-3.16-14.13-3.46-19.24-1.91-.84.25-1.72-.22-1.97-1.06-.25-.84.22-1.72 1.06-1.97 5.9-1.79 15.64-1.44 21.78 2.2.76.45 1.01 1.43.56 2.19-.45.76-1.43 1.01-2.19.56z" />
            <path d="M42.54 11.52h-2.16v13.92h-2.88V11.52h-2.16V9.12h7.2v2.4zm6.48 14.16c-3.84 0-6.48-2.64-6.48-6.48s2.64-6.48 6.48-6.48 6.48 2.64 6.48 6.48-2.64 6.48-6.48 6.48zm0-2.4c2.16 0 3.6-1.68 3.6-4.08s-1.44-4.08-3.6-4.08-3.6 1.68-3.6 4.08 1.44 4.08 3.6 4.08zm11.52 2.4c-2.64 0-4.56-1.2-5.28-3.12h2.64c.48 1.2 1.44 1.68 2.64 1.68 1.44 0 2.16-.72 2.16-1.68 0-1.2-1.2-1.44-2.88-1.92-2.4-.72-4.08-1.44-4.08-3.84 0-2.16 1.68-3.84 4.56-3.84 2.4 0 4.32 1.2 4.8 2.88h-2.64c-.48-.96-1.2-1.44-2.16-1.44-1.2 0-1.92.72-1.92 1.44 0 .96.96 1.2 2.64 1.68 2.64.72 4.32 1.68 4.32 4.08 0 2.4-1.92 4.08-4.8 4.08zm10.56-13.92h-2.64v8.88c0 1.2.48 1.68 1.44 1.68.48 0 .96-.24 1.2-.48v2.16c-.48.24-1.2.48-2.16.48-2.16 0-3.36-1.2-3.36-3.6v-9.12h-1.92V9.12h1.92V5.52h2.88v3.6h2.64v2.64zm4.32-4.32c-.96 0-1.68-.72-1.68-1.68s.72-1.68 1.68-1.68 1.68.72 1.68 1.68-.72 1.68-1.68 1.68zm-1.44 18.24V9.12h2.88v16.32h-2.88zm8.64.24c-2.64 0-4.56-1.2-5.28-3.12h2.64c.48 1.2 1.44 1.68 2.64 1.68 1.44 0 2.16-.72 2.16-1.68 0-1.2-1.2-1.44-2.88-1.92-2.4-.72-4.08-1.44-4.08-3.84 0-2.16 1.68-3.84 4.56-3.84 2.4 0 4.32 1.2 4.8 2.88h-2.64c-.48-.96-1.2-1.44-2.16-1.44-1.2 0-1.92.72-1.92 1.44 0 .96.96 1.2 2.64 1.68 2.64.72 4.32 1.68 4.32 4.08 0 2.4-1.92 4.08-4.8 4.08zm10.56-13.92h-2.64v8.88c0 1.2.48 1.68 1.44 1.68.48 0 .96-.24 1.2-.48v2.16c-.48.24-1.2.48-2.16.48-2.16 0-3.36-1.2-3.36-3.6v-9.12h-1.92V9.12h1.92V5.52h2.88v3.6h2.64v2.64zm4.32-4.32c-.96 0-1.68-.72-1.68-1.68s.72-1.68 1.68-1.68 1.68.72 1.68 1.68-.72 1.68-1.68 1.68zm-1.44 18.24V9.12h2.88v16.32h-2.88zm10.56.24c-2.64 0-4.56-1.2-5.28-3.12h2.64c.48 1.2 1.44 1.68 2.64 1.68 1.44 0 2.16-.72 2.16-1.68 0-1.2-1.2-1.44-2.88-1.92-2.4-.72-4.08-1.44-4.08-3.84 0-2.16 1.68-3.84 4.56-3.84 2.4 0 4.32 1.2 4.8 2.88h-2.64c-.48-.96-1.2-1.44-2.16-1.44-1.2 0-1.92.72-1.92 1.44 0 .96.96 1.2 2.64 1.68 2.64.72 4.32 1.68 4.32 4.08 0 2.4-1.92 4.08-4.8 4.08z" />
          </svg>
        </a>
        <nav className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm font-bold text-white">
            <li><a href="/get-started" className="hover:text-gray-300 transition-colors">Get started</a></li>
            <li><button className="hover:text-gray-300 transition-colors">Features</button></li>
            <li><button className="hover:text-gray-300 transition-colors">Resources</button></li>
            <li><a href="https://support.spotify.com/artists/" className="hover:text-gray-300 transition-colors">Help</a></li>
          </ul>
        </nav>
      </div>
      <div className="flex items-center gap-6">
        <button aria-label="Change language" className="text-white hover:text-gray-300 transition-colors">
          <Globe size={20} />
        </button>
        <button className="text-sm font-bold text-white hover:text-gray-300 transition-colors">
          Log in
        </button>
        <a href="https://artists.spotify.com/c/claim" className="bg-white text-black text-sm font-bold py-2 px-6 rounded-full hover:scale-105 transition-transform">
          Get access
        </a>
      </div>
    </header>
  );
};