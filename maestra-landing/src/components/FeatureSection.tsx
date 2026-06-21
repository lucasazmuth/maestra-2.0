import React from 'react';
import { Check } from 'lucide-react';

interface FeatureSectionProps {
  badge?: string;
  title: string;
  description: string;
  items: string[];
  icon: React.ReactNode;
  reverse?: boolean;
}

export const FeatureSection: React.FC<FeatureSectionProps> = ({ badge, title, description, items, icon, reverse = false }) => (
  <section className="bg-black text-white py-14 md:py-20 px-5 md:px-8">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <div className={`rounded-xl border border-white/10 bg-[#0c0c0c] aspect-[4/3] flex items-center justify-center ${reverse ? 'lg:order-2' : ''}`}>
        <span className="text-white/15">{icon}</span>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>
        {badge && <span className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">{badge}</span>}
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">{title}</h2>
        <p className="text-lg text-gray-300 leading-relaxed mb-7">{description}</p>
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-3 text-gray-200">
              <Check size={20} className="shrink-0 mt-0.5 text-[#af2896]" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);
