import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';

interface FeatureItem {
  text: React.ReactNode;
  iconColor: string;
}

interface FeatureSectionProps {
  title: string;
  description: React.ReactNode;
  items: FeatureItem[];
  ctaText: string;
  ctaLink: string;
  videoPoster: string;
  reverse?: boolean;
}

export const FeatureSection: React.FC<FeatureSectionProps> = ({
  title,
  description,
  items,
  ctaText,
  ctaLink,
  videoPoster,
  reverse = false
}) => {
  return (
    <section className="bg-black text-white py-24 px-6 md:px-12 lg:px-24">
      <div className={`max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${reverse ? 'lg:flex-row-reverse' : ''}`}>
        
        <div className={`relative aspect-square rounded-2xl overflow-hidden group cursor-pointer ${reverse ? 'lg:order-2' : 'lg:order-1'}`}>
          <img 
            src={videoPoster} 
            alt={title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-lg">
              <Play size={24} fill="currentColor" className="ml-1" />
            </button>
          </div>
        </div>

        <div className={reverse ? 'lg:order-1' : 'lg:order-2'}>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">{title}</h2>
          <p className="text-lg text-gray-300 mb-8 leading-relaxed">{description}</p>
          
          <ul className="space-y-6 mb-10">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-4">
                <CheckCircle2 className={`shrink-0 mt-1 ${item.iconColor}`} size={24} />
                <span className="text-lg text-gray-200">{item.text}</span>
              </li>
            ))}
          </ul>

          <a 
            href={ctaLink}
            className="inline-block bg-white text-black font-bold py-3 px-8 rounded-full hover:scale-105 transition-transform"
          >
            {ctaText}
          </a>
        </div>

      </div>
    </section>
  );
};