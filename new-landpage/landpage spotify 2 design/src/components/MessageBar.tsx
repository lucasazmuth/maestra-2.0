import React, { useState } from 'react';
import { X } from 'lucide-react';

const MessageBar: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-[#0066ff] text-white px-4 py-3 flex justify-center items-center relative z-50">
      <div className="text-sm font-bold hover:underline cursor-pointer">
        <a href="https://www.spotify.com/br-en/premium/">Brazil (English)</a>
      </div>
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default MessageBar;