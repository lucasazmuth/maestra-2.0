import React, { useState } from 'react';

const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={() => setIsVisible(false)}></div>
      <div className="bg-white text-black w-full max-w-[1200px] p-6 md:p-8 relative z-10 pointer-events-auto shadow-2xl flex flex-col md:flex-row gap-8 items-start">
        
        <div className="flex-1 space-y-4">
          <h2 className="text-2xl font-bold">Deine Privatsphäre ist uns wichtig</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Wir und unsere <span className="font-bold">87</span> Partner speichern Informationen auf Geräten und/oder greifen darauf zu, z. B. eindeutige IDs in Cookies, um personenbezogene Daten zu verarbeiten. Klicke unten auf „Cookie-Einstellungen“, um mehr über die Zwecke zu erfahren, für die wir und unsere Partner Cookies verwenden, oder um die Einstellungen zu ändern. Du kannst deine Einstellungen jederzeit überprüfen oder deine Einwilligung widerrufen, indem du in unserer Cookie-Richtlinie auf den Link zu deinen Cookie-Einstellungen klickst. Diese Entscheidungen werden unseren Partnern mitgeteilt und haben keinen Einfluss auf die Browsingdaten.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Indem Du auf “Cookies akzeptieren” klickst, willigst Du in unsere Nutzung und die Weitergabe Deiner Daten an <a href="#" className="underline font-bold">unsere Partner</a> ein.
          </p>
        </div>

        <div className="flex-1 space-y-4">
          <h3 className="font-bold text-base">Wir und unsere Partner verarbeiten Daten, um Folgendes bereitzustellen:</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            Speichern von oder Zugriff auf Informationen auf einem Endgerät. Personalisierte Werbung. Personalisierte Inhalte. Messung von Werbeleistung und der Performance von Inhalten, Zielgruppenforschung sowie Entwicklung und Verbesserung der Angebote.
          </p>
          <p className="text-sm text-gray-700">
            Weitere Informationen zu unseren Partnern und zum Opt-out findest Du in unserer:
          </p>
          <button className="text-sm font-bold underline uppercase tracking-wider">
            Liste der Partner (Anbieter)
          </button>
        </div>

        <div className="w-full md:w-auto flex flex-col gap-3 mt-4 md:mt-0">
          <button 
            onClick={() => setIsVisible(false)}
            className="bg-black text-white font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform text-sm tracking-widest uppercase whitespace-nowrap"
          >
            Cookies akzeptieren
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="bg-black text-white font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform text-sm tracking-widest uppercase whitespace-nowrap"
          >
            Alle ablehnen
          </button>
          <button className="text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform text-sm tracking-widest uppercase whitespace-nowrap">
            Cookie Einstellungen
          </button>
        </div>

      </div>
    </div>
  );
};

export default CookieBanner;