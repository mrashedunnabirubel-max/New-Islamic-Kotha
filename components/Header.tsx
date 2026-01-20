
import React, { useState } from 'react';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  onClearChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ status, onClearChat }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const getStatusColor = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED: return 'bg-green-500';
      case ConnectionStatus.CONNECTING: return 'bg-yellow-500 animate-pulse';
      case ConnectionStatus.ERROR: return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED: return 'অনলাইন';
      case ConnectionStatus.CONNECTING: return 'সংযুক্ত হচ্ছে...';
      case ConnectionStatus.ERROR: return 'সংযোগ ত্রুটি';
      default: return 'বিচ্ছিন্ন';
    }
  };

  return (
    <header className="bg-[#075e54] text-white py-4 px-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center space-x-3">
        {/* Left Islamic Icon */}
        <div className="text-emerald-200 text-2xl">
          <i className="fas fa-star-and-crescent"></i>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border-2 border-emerald-400">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&top=shortHair&accessories=round&facialHair=beardLight" 
              alt="AI Scholar" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">ইসলামিক কথা</h1>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
              <span className="text-[10px] opacity-90">{getStatusText()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
        >
          <i className="fas fa-ellipsis-v text-xl"></i>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-[100] border border-slate-100">
            <button 
              onClick={() => {
                onClearChat();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 text-red-600 hover:bg-slate-50 flex items-center space-x-3 transition-colors"
            >
              <i className="fas fa-trash-alt"></i>
              <span className="font-medium">চ্যাট মুছে ফেলুন</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Click outside to close menu */}
      {menuOpen && (
        <div 
          className="fixed inset-0 z-[90]" 
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
