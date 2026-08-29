import React from 'react';
import { Home, Compass, Plus, Clock, User } from 'lucide-react';

export interface ActiveProgressData {
  progress: number;
  currentTime: number;
  duration: number;
  onSeek: (percentage: number) => void;
}

interface BottomNavProps {
  currentNav: 'home' | 'explore' | 'history' | 'profile';
  onChangeNav: (nav: 'home' | 'explore' | 'history' | 'profile') => void;
  onOpenUpload: () => void;
  activeProgressData?: ActiveProgressData | null;
  isAuthenticated?: boolean;
  userProfile?: any;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  currentNav,
  onChangeNav,
  onOpenUpload,
  isAuthenticated,
  userProfile
}) => {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 h-14 sm:h-15 bg-gradient-to-t from-black/95 via-black/80 to-black/20 backdrop-blur-md border-t border-white/10 px-2 sm:px-4 flex items-center justify-around text-white pointer-events-auto select-none">
      {/* Home */}
      <button
        id="nav-home"
        onClick={() => onChangeNav('home')}
        className={`flex flex-col items-center gap-0.5 group active:scale-95 transition-transform ${
          currentNav === 'home' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Home className={`w-4 h-4 sm:w-5 sm:h-5 ${currentNav === 'home' ? 'stroke-[2.5]' : ''}`} />
        <span className="text-[9px] sm:text-[10px]">Home</span>
      </button>

      {/* Explore */}
      <button
        id="nav-explore"
        onClick={() => onChangeNav('explore')}
        className={`flex flex-col items-center gap-0.5 group active:scale-95 transition-transform ${
          currentNav === 'explore' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Compass className={`w-4 h-4 sm:w-5 sm:h-5 ${currentNav === 'explore' ? 'stroke-[2.5]' : ''}`} />
        <span className="text-[9px] sm:text-[10px]">Explore</span>
      </button>

      {/* Center Button (Avatar or Plus) */}
      <button
        id="nav-center-action"
        onClick={onOpenUpload}
        className={`relative group active:scale-90 transition-transform flex items-center justify-center shrink-0 ${
          isAuthenticated && userProfile 
            ? 'w-10 h-10 rounded-full overflow-hidden shadow-[0_0_10px_rgba(236,72,153,0.3)] border-2 border-pink-500 bg-zinc-900 -mt-4' 
            : 'w-10 h-7 rounded-lg overflow-hidden shadow-[0_0_10px_rgba(236,72,153,0.3)]'
        }`}
        title={isAuthenticated ? 'Account' : 'Sign In'}
      >
        {isAuthenticated && userProfile ? (
          <img 
            src={`https://api.dicebear.com/7.x/${userProfile.avatarStyle || 'adventurer'}/svg?seed=${userProfile.avatarSeed}`} 
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <div 
              className="absolute inset-[-150%] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-spin" 
              style={{ animationDuration: '3s' }} 
            />
            <div className="absolute inset-[2px] bg-black rounded-[6px] z-10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white stroke-[3]" />
            </div>
          </>
        )}
      </button>

      {/* Historie (Watch History) */}
      <button
        id="nav-history"
        onClick={() => onChangeNav('history')}
        className={`flex flex-col items-center gap-0.5 group active:scale-95 transition-transform relative ${
          currentNav === 'history' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className="relative">
          <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${currentNav === 'history' ? 'stroke-[2.5] text-pink-400' : ''}`} />
        </div>
        <span className="text-[9px] sm:text-[10px]">Historie</span>
      </button>

      {/* Profile */}
      <button
        id="nav-profile"
        onClick={() => onChangeNav('profile')}
        className={`flex flex-col items-center gap-0.5 group active:scale-95 transition-transform ${
          currentNav === 'profile' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
        }`}
      >
        <User className={`w-4 h-4 sm:w-5 sm:h-5 ${currentNav === 'profile' ? 'stroke-[2.5]' : ''}`} />
        <span className="text-[9px] sm:text-[10px]">Profile</span>
      </button>
    </nav>
  );
});
