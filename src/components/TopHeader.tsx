import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Search, Sparkles, Flame } from 'lucide-react';
import { ServerType } from '../types/anime';

export interface TopHeaderHandle {
  updateUnderline: (offset: number, animate: boolean) => void;
}

interface TopHeaderProps {
  activeTab: 'following' | 'foryou' | 'latest' | 'reels';
  onChangeTab: (tab: 'following' | 'foryou' | 'latest' | 'reels') => void;
  server: ServerType;
  onChangeServer: (s: ServerType) => void;
  onOpenSearch: () => void;
}

const TABS: Array<'following' | 'foryou' | 'latest' | 'reels'> = ['following', 'foryou', 'latest', 'reels'];

export const TopHeader = forwardRef<TopHeaderHandle, TopHeaderProps>(({
  activeTab,
  onChangeTab,
  onOpenSearch,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const indicatorRef = useRef<HTMLDivElement>(null);

  const calculateUnderline = (offset: number) => {
    const currentIdx = TABS.indexOf(activeTab);
    const screenWidth = window.innerWidth || 360;
    const progress = -offset / screenWidth;
    const continuousIndex = Math.max(0, Math.min(TABS.length - 1, currentIdx + progress));

    const idx0 = Math.floor(continuousIndex);
    const idx1 = Math.min(TABS.length - 1, idx0 + 1);
    const t = continuousIndex - idx0;

    const btn0 = buttonRefs.current[TABS[idx0]];
    const btn1 = buttonRefs.current[TABS[idx1]];

    if (!btn0 || !containerRef.current || !indicatorRef.current) return;

    const left0 = btn0.offsetLeft;
    const width0 = btn0.offsetWidth;

    let left = left0;
    let width = width0;

    if (btn1 && idx0 !== idx1) {
      const left1 = btn1.offsetLeft;
      const width1 = btn1.offsetWidth;
      left = left0 + (left1 - left0) * t;
      width = width0 + (width1 - width0) * t;
    }

    indicatorRef.current.style.left = `${left}px`;
    indicatorRef.current.style.width = `${width}px`;

    if (continuousIndex >= 2.5) {
      indicatorRef.current.style.backgroundColor = '#10b981';
    } else if (continuousIndex >= 1.5) {
      indicatorRef.current.style.backgroundColor = '#22d3ee';
    } else {
      indicatorRef.current.style.backgroundColor = '#ec4899';
    }
  };

  const updateUnderline = (offset: number, animate: boolean) => {
    if (!indicatorRef.current) return;
    indicatorRef.current.style.transition = animate
      ? 'left 0.32s cubic-bezier(0.2, 0.9, 0.3, 1), width 0.32s cubic-bezier(0.2, 0.9, 0.3, 1), background-color 0.32s ease'
      : 'none';
    calculateUnderline(offset);
  };

  useImperativeHandle(ref, () => ({
    updateUnderline,
  }));

  useEffect(() => {
    // Timeout ensures DOM dimensions are fully measured after render/font load
    const timer = setTimeout(() => {
      updateUnderline(0, true);
    }, 10);
    return () => clearTimeout(timer);
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => updateUnderline(0, false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-2.5 sm:px-4 pt-3 sm:pt-4 pb-2 flex items-center justify-between text-white pointer-events-auto select-none">
      {/* Left spacer to keep center tabs balanced */}
      <div className="w-8 h-8 pointer-events-none" />

      {/* Main Tabs in Center: Following | For You | Latest */}
      <div ref={containerRef} className="relative flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-bold drop-shadow-md">
        <button
          ref={(el) => { buttonRefs.current['following'] = el; }}
          onClick={() => onChangeTab('following')}
          className={`relative py-1 transition-colors ${
            activeTab === 'following'
              ? 'text-white text-xs sm:text-base font-bold'
              : 'text-gray-300/80 hover:text-white'
          }`}
        >
          Liked
        </button>

        <button
          ref={(el) => { buttonRefs.current['foryou'] = el; }}
          onClick={() => onChangeTab('foryou')}
          className={`relative py-1 transition-colors flex items-center gap-0.5 sm:gap-1 ${
            activeTab === 'foryou'
              ? 'text-white text-xs sm:text-base font-black'
              : 'text-gray-300/80 hover:text-white'
          }`}
        >
          For You
        </button>

        <button
          ref={(el) => { buttonRefs.current['latest'] = el; }}
          onClick={() => onChangeTab('latest')}
          className={`relative py-1 transition-colors flex items-center gap-0.5 sm:gap-1 ${
            activeTab === 'latest'
              ? 'text-white text-xs sm:text-base font-black'
              : 'text-gray-300/80 hover:text-white'
          }`}
        >
          Latest
        </button>

        <button
          ref={(el) => { buttonRefs.current['reels'] = el; }}
          onClick={() => onChangeTab('reels')}
          className={`relative py-1 transition-colors flex items-center gap-0.5 sm:gap-1 ${
            activeTab === 'reels'
              ? 'text-white text-xs sm:text-base font-black'
              : 'text-gray-300/80 hover:text-white'
          }`}
        >
          Reels
        </button>

        {/* Dynamic Underline covering full text width of active tab, moving in real time */}
        <div
          ref={indicatorRef}
          className="absolute bottom-0 h-0.5 rounded-full pointer-events-none shadow-md"
          style={{
            backgroundColor: activeTab === 'reels' ? '#10b981' : activeTab === 'latest' ? '#22d3ee' : '#ec4899',
          }}
        />
      </div>

      {/* Search Icon on Right */}
      <button
        id="btn-top-search"
        onClick={onOpenSearch}
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/50 backdrop-blur-md border border-zinc-800 flex items-center justify-center text-zinc-100 hover:bg-black/70 hover:border-zinc-700 active:scale-90 transition-all shadow-lg"
        title="Search Anime"
      >
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </header>
  );
});

