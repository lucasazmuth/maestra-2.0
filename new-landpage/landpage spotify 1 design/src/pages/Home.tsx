import React from 'react';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { FeaturesIntro } from '../components/FeaturesIntro';
import { FeatureSection } from '../components/FeatureSection';
import { ArtistCarousel } from '../components/ArtistCarousel';
import { NewsSection } from '../components/NewsSection';
import { CTASection } from '../components/CTASection';
import { Footer } from '../components/Footer';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-black font-sans">
      <Header />
      <main>
        <Hero />
        <FeaturesIntro />
        
        <FeatureSection 
          title="Find your next fans"
          description="Turn up your music with Campaign Kit — a set of tools designed to drive meaningful metrics for artists and music marketers. Expand your reach and build lifelong fans."
          items={[
            { text: <><a href="#" className="underline hover:text-white">Display campaigns</a> put your music front-and-center, with formats like Marquee and Showcase.</>, iconColor: 'text-[#AF93C4]' },
            { text: <><a href="#" className="underline hover:text-white">Discovery Mode</a> can give your music a boost in personalized playlists.</>, iconColor: 'text-[#AF93C4]' },
            { text: <>Share your upcoming tracks with Spotify editors using <a href="#" className="underline hover:text-white">playlist pitching</a>.</>, iconColor: 'text-[#AF93C4]' }
          ]}
          ctaText="Explore Campaign Kit"
          ctaLink="/campaign-kit"
          videoPoster="https://image.mux.com/kmLQNcNh8LemflWQ31pHOARnxF1myZ8PmyfjZjNW2dQ/thumbnail.jpg?width=1600"
        />

        <FeatureSection 
          title="Connect with fans"
          description="Invite listeners into your creative world. Customize your artist profile, create videos & visuals, and bring the story behind your music to life."
          items={[
            { text: <><a href="#" className="underline hover:text-white">Clips</a> are short videos you create to connect with fans while keeping your music front-and-center.</>, iconColor: 'text-[#CFF56A]' },
            { text: <>Add a <a href="#" className="underline hover:text-white">Canvas</a> – a short, looping visual – to each of your tracks on Spotify.</>, iconColor: 'text-[#CFF56A]' },
            { text: <><a href="#" className="underline hover:text-white">Countdown Pages</a> help you get fans hyped for your upcoming album.</>, iconColor: 'text-[#CFF56A]' },
            { text: <>Your <a href="#" className="underline hover:text-white">artist profile</a> shows fans what you're all about.</>, iconColor: 'text-[#CFF56A]' }
          ]}
          ctaText="Explore Video & Visuals"
          ctaLink="/video-and-visuals"
          videoPoster="https://image.mux.com/dzTWSdxUdcNqC8W3Gi55vtdt3F2cPN1nlLDeTdGTn4Y/thumbnail.jpg?width=1600"
          reverse
        />

        <FeatureSection 
          title="Grow your business"
          description={<>There are many ways to earn revenue as an artist on Spotify. While <a href="#" className="underline hover:text-white">Loud & Clear</a> is your source for data, resources, and transparency around streaming royalties, here are some other opportunities to explore.</>}
          items={[
            { text: <><a href="#" className="underline hover:text-white">Sell and promote merch</a> on Spotify, because music and merch are better together.</>, iconColor: 'text-[#19E68C]' },
            { text: <>List your <a href="#" className="underline hover:text-white">concert and festival dates</a> to make sure your fans never miss another show.</>, iconColor: 'text-[#19E68C]' },
            { text: <><a href="#" className="underline hover:text-white">Fan Support</a> lets you collect tips, or rally listeners around a charitable cause.</>, iconColor: 'text-[#19E68C]' }
          ]}
          ctaText="Explore Merch, Live, & More"
          ctaLink="/merch-live-and-more"
          videoPoster="https://image.mux.com/w8J20144NUGi00yZ602ETscNQlxLRVkt9SIclAbJE00iktg/thumbnail.jpg?width=1600"
        />

        <FeatureSection 
          title="Understand your audience"
          description="Dig into audience, playlist, and music data to help you reach your goals."
          items={[
            { text: <><a href="#" className="underline hover:text-white">Segments</a> allow you to better understand the breakdown of your audience.</>, iconColor: 'text-[#A5BBD1]' },
            { text: <>Hone your marketing strategy with release engagement and <a href="#" className="underline hover:text-white">listener conversion metrics</a>.</>, iconColor: 'text-[#A5BBD1]' },
            { text: <><a href="#" className="underline hover:text-white">Fan Study</a> is our ongoing report about fan behavior around the world.</>, iconColor: 'text-[#A5BBD1]' }
          ]}
          ctaText="Explore analytics"
          ctaLink="/analytics"
          videoPoster="https://image.mux.com/S8VihUTFcOdtan9I01RxvefFCimRCSN8jlOLXEwirJP00/thumbnail.jpg?width=1600"
          reverse
        />

        <ArtistCarousel />
        <NewsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Home;