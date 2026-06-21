import React from 'react';
import { Instagram, Twitter, Linkedin, Globe } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white pt-20 pb-10 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between gap-16 mb-20">
          
          <div className="lg:w-1/4">
            <a href="https://www.spotify.com" aria-label="Spotify">
              <svg viewBox="0 0 113 32" width="113" height="32" fill="currentColor">
                <path d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm7.317 23.066c-.303.496-.93.65-1.426.347-3.904-2.384-8.814-2.923-14.61-.16-.55.26-1.21-.01-1.47-.56-.26-.55.01-1.21.56-1.47 6.33-3.01 11.76-2.4 16.15.28.496.303.65.93.347 1.426zm1.99-4.43c-.38.618-1.166.806-1.784.426-4.45-2.736-11.25-3.54-16.28-1.936-.69.22-1.42-.16-1.64-.85-.22-.69.16-1.42.85-1.64 5.78-1.84 13.28-.95 18.43 2.216.618.38.806 1.166.426 1.784zm.14-4.59c-5.33-3.16-14.13-3.46-19.24-1.91-.84.25-1.72-.22-1.97-1.06-.25-.84.22-1.72 1.06-1.97 5.9-1.79 15.64-1.44 21.78 2.2.76.45 1.01 1.43.56 2.19-.45.76-1.43 1.01-2.19.56z" />
                <path d="M42.54 11.52h-2.16v13.92h-2.88V11.52h-2.16V9.12h7.2v2.4zm6.48 14.16c-3.84 0-6.48-2.64-6.48-6.48s2.64-6.48 6.48-6.48 6.48 2.64 6.48 6.48-2.64 6.48-6.48 6.48zm0-2.4c2.16 0 3.6-1.68 3.6-4.08s-1.44-4.08-3.6-4.08-3.6 1.68-3.6 4.08 1.44 4.08 3.6 4.08zm11.52 2.4c-2.64 0-4.56-1.2-5.28-3.12h2.64c.48 1.2 1.44 1.68 2.64 1.68 1.44 0 2.16-.72 2.16-1.68 0-1.2-1.2-1.44-2.88-1.92-2.4-.72-4.08-1.44-4.08-3.84 0-2.16 1.68-3.84 4.56-3.84 2.4 0 4.32 1.2 4.8 2.88h-2.64c-.48-.96-1.2-1.44-2.16-1.44-1.2 0-1.92.72-1.92 1.44 0 .96.96 1.2 2.64 1.68 2.64.72 4.32 1.68 4.32 4.08 0 2.4-1.92 4.08-4.8 4.08zm10.56-13.92h-2.64v8.88c0 1.2.48 1.68 1.44 1.68.48 0 .96-.24 1.2-.48v2.16c-.48.24-1.2.48-2.16.48-2.16 0-3.36-1.2-3.36-3.6v-9.12h-1.92V9.12h1.92V5.52h2.88v3.6h2.64v2.64zm4.32-4.32c-.96 0-1.68-.72-1.68-1.68s.72-1.68 1.68-1.68 1.68.72 1.68 1.68-.72 1.68-1.68 1.68zm-1.44 18.24V9.12h2.88v16.32h-2.88zm8.64.24c-2.64 0-4.56-1.2-5.28-3.12h2.64c.48 1.2 1.44 1.68 2.64 1.68 1.44 0 2.16-.72 2.16-1.68 0-1.2-1.2-1.44-2.88-1.92-2.4-.72-4.08-1.44-4.08-3.84 0-2.16 1.68-3.84 4.56-3.84 2.4 0 4.32 1.2 4.8 2.88h-2.64c-.48-.96-1.2-1.44-2.16-1.44-1.2 0-1.92.72-1.92 1.44 0 .96.96 1.2 2.64 1.68 2.64.72 4.32 1.68 4.32 4.08 0 2.4-1.92 4.08-4.8 4.08zm10.56-13.92h-2.64v8.88c0 1.2.48 1.68 1.44 1.68.48 0 .96-.24 1.2-.48v2.16c-.48.24-1.2.48-2.16.48-2.16 0-3.36-1.2-3.36-3.6v-9.12h-1.92V9.12h1.92V5.52h2.88v3.6h2.64v2.64zm4.32-4.32c-.96 0-1.68-.72-1.68-1.68s.72-1.68 1.68-1.68 1.68.72 1.68 1.68-.72 1.68-1.68 1.68zm-1.44 18.24V9.12h2.88v16.32h-2.88zm10.56.24c-2.64 0-4.56-1.2-5.28-3.12h2.64c.48 1.2 1.44 1.68 2.64 1.68 1.44 0 2.16-.72 2.16-1.68 0-1.2-1.2-1.44-2.88-1.92-2.4-.72-4.08-1.44-4.08-3.84 0-2.16 1.68-3.84 4.56-3.84 2.4 0 4.32 1.2 4.8 2.88h-2.64c-.48-.96-1.2-1.44-2.16-1.44-1.2 0-1.92.72-1.92 1.44 0 .96.96 1.2 2.64 1.68 2.64.72 4.32 1.68 4.32 4.08 0 2.4-1.92 4.08-4.8 4.08z" />
              </svg>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:w-2/4">
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Helpful Links</h4>
              <ul className="space-y-4">
                <li><a href="#" className="hover:text-gray-300 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Press & Media</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Providers</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Loud & Clear</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Creator Tools</h4>
              <ul className="space-y-4">
                <li><a href="#" className="hover:text-gray-300 transition-colors">Spotify for Authors</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Spotify for Creators</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Songwriting</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Get The App</h4>
              <div className="space-y-4">
                <a href="#" className="block"><img src="//images.ctfassets.net/lnhrh9gqejzl/3f47r3hsq1UeTC7YDVVdpX/0cd2ca1606246e4bd1d854cefab06972/footer-ios-a77e2676a3ffba2c521ce743a6d82eea.svg" alt="Download on the App Store" className="h-10" /></a>
                <a href="#" className="block"><img src="//images.ctfassets.net/lnhrh9gqejzl/3v0BeAMmo25nBpqqYKTiAf/fc5fe970d1f54f73270110dd54512fd7/footer-android-1e8a7815136447656dae5d9e77dfd5ad.svg" alt="Get it on Google Play" className="h-10" /></a>
              </div>
            </div>
          </div>

          <div className="flex gap-4 lg:w-1/4 lg:justify-end">
            <a href="#" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><Instagram size={20} /></a>
            <a href="#" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><Twitter size={20} /></a>
            <a href="#" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><Linkedin size={20} /></a>
            <a href="#" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.2c0 1.73-.41 3.48-1.34 4.94-1.31 2.06-3.56 3.44-5.99 3.68-2.43.24-4.94-.4-6.84-1.9-1.9-1.5-3.06-3.8-3.22-6.23-.16-2.43.68-4.86 2.34-6.56 1.66-1.7 3.99-2.64 6.36-2.64.11 0 .22 0 .33.01v4.1c-1.26-.06-2.54.26-3.56.98-1.02.72-1.72 1.84-1.92 3.08-.2 1.24.1 2.54.82 3.56.72 1.02 1.84 1.72 3.08 1.92 1.24.2 2.54-.1 3.56-.82 1.02-.72 1.72-1.84 1.92-3.08V.02z"/></svg>
            </a>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-sm text-gray-400">
          <div className="flex flex-wrap items-center gap-6 mb-4 md:mb-0">
            <span>© 2026 Spotify AB</span>
            <a href="#" className="hover:text-white transition-colors">Legal</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
          </div>
          <button className="flex items-center gap-2 hover:text-white transition-colors">
            <Globe size={16} />
            <span className="font-bold">English</span>
          </button>
        </div>
      </div>
    </footer>
  );
};