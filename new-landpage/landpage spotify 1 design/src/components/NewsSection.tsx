import React from 'react';

const newsItems = [
  {
    title: 'Your Guide to Mental Health Support in the Music Industry',
    desc: 'How to access the B-LINE 24/7 confidential support line and additional care options.',
    img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    bgClass: 'bg-gray-100'
  },
  {
    title: 'Music Videos',
    desc: 'Build stronger fan connections and drive more streams by releasing your music videos on Spotify.',
    img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    bgClass: 'bg-gray-100'
  },
  {
    title: 'Spotlighting the people, connections, and stories behind your music',
    desc: 'We’re expanding Song Credits and introducing SongDNA and About the song to inspire fans to go deeper into your creative world and process.',
    img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    bgClass: 'bg-gray-100'
  },
  {
    title: 'Super Listeners: Your Guide for Developing Fans Who Go Deeper',
    desc: 'Success on Spotify is more than putting music out — it\'s about pulling your audience in.',
    img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    bgClass: 'bg-gray-100'
  },
  {
    title: 'Celebrating the release moment with Jorja Smith',
    desc: 'Dropping new music is about way more than hitting upload. It\'s crumpled notebook pages, voice notes, and late nights release planning. It\'s counting down, finding meaning in the lyrics, and connecting with your fans. Jorja Smith uses Spotify for Artists.',
    img: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    bgClass: 'bg-gray-200'
  }
];

export const NewsSection: React.FC = () => {
  return (
    <section className="bg-white text-black py-24 px-6 md:px-12 lg:px-24 rounded-t-[3rem] -mt-12 relative z-20">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold mb-12">New & noteworthy</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {newsItems.map((item, i) => (
            <a key={i} href="#" className="group block">
              <div className={`aspect-video w-full mb-4 rounded-lg overflow-hidden ${item.bgClass}`}>
                <img src={item.img} alt="" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:underline">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};