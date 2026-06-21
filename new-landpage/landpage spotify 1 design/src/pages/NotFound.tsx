import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl mb-8">Page not found</p>
      <Link to="/" className="bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform">
        Go Home
      </Link>
    </div>
  );
};

export default NotFound;