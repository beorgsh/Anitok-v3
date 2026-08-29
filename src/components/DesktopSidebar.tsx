import React from 'react';
import { Home, Compass, UserCheck, Flame, Bookmark, Tv, Keyboard, Sparkles, Monitor, DraftingCompass } from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: 'following' | 'foryou' | 'latest';
  onChangeTab: (tab: 'following' | 'foryou' | 'latest') => void;
  server: 'hd-1' | 'hd-2';
  onChangeServer: (s: 'hd-1' | 'hd-2') => void;
  onOpenUpload: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onChangeTab,
  server,
  onChangeServer,
  onOpenUpload,
}) => {
  return (
    <aside className="w-64 bg-gray-950/90 backdrop-blur-xl border-r border-gray-800/80 p-5 flex flex-col justify-between hidden lg:flex select-none z-30 shrink-0">
      <div className="flex flex-col gap-6">
        {/* Ani-Tok Anime Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 p-[2px] shadow-xl flex items-center justify-center">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <DraftingCompass className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight text-white flex items-center gap-1">
              Ani-Tok <span className="text-pink-500 text-xs px-1.5 py-0.5 rounded bg-pink-950/80 border border-pink-500/30">ANIME</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-medium">Short Stream & Prefetch</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          <button
            onClick={() => onChangeTab('foryou')}
            className={`w-full px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'foryou'
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>For You</span>
          </button>

          <button
            onClick={() => onChangeTab('latest')}
            className={`w-full px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'latest'
                ? 'bg-cyan-500 text-black font-extrabold shadow-lg shadow-cyan-500/20'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <Flame className="w-5 h-5 text-cyan-400" />
            <span>Latest Anime</span>
          </button>

          <button
            onClick={() => onChangeTab('following')}
            className={`w-full px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all ${
              activeTab === 'following'
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <span>Liked</span>
          </button>
        </nav>

        {/* Stream Server Quick Switch */}
        <div className="p-3.5 bg-gray-900/90 rounded-2xl border border-gray-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-300">
            <span className="flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-cyan-400" /> Server Stream
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-300 rounded font-mono border border-cyan-800">
              {server.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onChangeServer('hd-1')}
              className={`py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                server === 'hd-1'
                  ? 'bg-cyan-500 text-black border-cyan-400'
                  : 'bg-black/40 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              HD 1
            </button>
            <button
              onClick={() => onChangeServer('hd-2')}
              className={`py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                server === 'hd-2'
                  ? 'bg-cyan-500 text-black border-cyan-400'
                  : 'bg-black/40 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              HD 2
            </button>
          </div>
        </div>

        {/* Create / Upload button on Desktop */}
        <button
          onClick={onOpenUpload}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-pink-500 to-purple-600 text-white font-black text-sm shadow-xl hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>+ Upload Video</span>
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="p-3 bg-gray-900/60 rounded-2xl border border-gray-800/80 text-gray-400 text-xs flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-bold text-gray-200">
          <Keyboard className="w-3.5 h-3.5 text-pink-400" /> Controls Guide
        </div>
        <div className="flex justify-between text-[11px]">
          <span>Up / Down</span>
          <span className="font-mono text-gray-300">Next / Prev</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>Space</span>
          <span className="font-mono text-gray-300">Play / Pause</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>M</span>
          <span className="font-mono text-gray-300">Mute / Unmute</span>
        </div>
      </div>
    </aside>
  );
};
