import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Server, Type, Eye, EyeOff, Info, Share2, MessageCircle, Send, Code, Download, CheckCircle2, Sliders, Palette, MoveVertical, Sparkles, Terminal, FastForward } from 'lucide-react';
import toast from 'react-hot-toast';
import { AnimeItem, ServerType, SubtitleSettings } from '../types/anime';

interface ShareDrawerProps {
  anime: AnimeItem;
  isOpen: boolean;
  onClose: () => void;
  server?: ServerType;
  onServerChange?: (newServer: ServerType) => void;
  // Comprehensive Subtitle Settings
  subtitleSettings: SubtitleSettings;
  onUpdateSubtitleSettings: (settings: Partial<SubtitleSettings>) => void;
  hasSubtitles?: boolean;
  onOpenUpdates?: () => void;
}

const BG_COLOR_PRESETS = [
  { name: 'None', hex: 'none' },
  { name: 'Pure Black', hex: '#000000' },
  { name: 'Dark Zinc', hex: '#18181b' },
  { name: 'Midnight', hex: '#09090b' },
  { name: 'Deep Violet', hex: '#1e1b4b' },
  { name: 'Slate Blue', hex: '#0f172a' },
];

export const ShareDrawer: React.FC<ShareDrawerProps> = ({
  anime,
  isOpen,
  onClose,
  server = 'hd-2',
  onServerChange,
  subtitleSettings,
  onUpdateSubtitleSettings,
  hasSubtitles = true,
  onOpenUpdates,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const shareUrl = window.location.href;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!', {
      id: 'copy-link-toast',
      duration: 2500,
      icon: '🔗',
      style: {
        background: 'rgba(24, 24, 27, 0.95)',
        color: '#f4f4f5',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: '600',
      },
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareItems = [
    { name: 'Copy Link', icon: copied ? Check : Copy, action: handleCopy, color: 'bg-zinc-800 text-zinc-200 border-zinc-700' },
    { name: 'WhatsApp', icon: MessageCircle, action: () => { window.open(`https://wa.me/?text=${encodeURIComponent(anime.title + ' ' + shareUrl)}`, '_blank'); }, color: 'bg-zinc-800 text-emerald-400 border-zinc-700' },
    { name: 'Twitter / X', icon: Send, action: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(anime.title)}&url=${encodeURIComponent(shareUrl)}`, '_blank'); }, color: 'bg-zinc-800 text-sky-400 border-zinc-700' },
    { name: 'Save Poster', icon: Download, action: () => { window.open(anime.poster, '_blank'); }, color: 'bg-zinc-800 text-pink-400 border-zinc-700' },
    { name: 'Embed', icon: Code, action: handleCopy, color: 'bg-zinc-800 text-purple-400 border-zinc-700' },
  ];

  // Helper for live preview RGBA background
  const hexToRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const bigint = parseInt(cleanHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
  };

  const previewBgRgba = `rgba(${hexToRgb(subtitleSettings.backgroundColor || '#000000')}, ${(subtitleSettings.bgOpacity ?? 85) / 100})`;
  const previewTextColor =
    subtitleSettings.color === 'yellow' ? '#fef08a' : subtitleSettings.color === 'cyan' ? '#67e8f9' : '#ffffff';

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={`share-drawer-${anime.id}`}
          key="share-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 select-none"
          onClick={onClose}
        >
          <motion.div
            key="share-drawer-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="w-full max-w-md mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
        {/* TikTok Mobile Grab Handle */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/90">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-pink-400" />
            <h3 className="font-bold text-sm text-zinc-100">Settings & Share</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings List */}
        <div className="flex flex-col divide-y divide-zinc-800/80 my-2">
          {/* Server Source */}
          <div className="py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-200">Server Source</span>
              </div>
              <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                <button
                  onClick={() => onServerChange && onServerChange('hd-2')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    server === 'hd-2'
                      ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {server === 'hd-2' && <CheckCircle2 className="w-3 h-3 text-pink-400" />}
                  HD-2 (Fast)
                </button>
                <button
                  onClick={() => onServerChange && onServerChange('hd-1')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    server === 'hd-1'
                      ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {server === 'hd-1' && <CheckCircle2 className="w-3 h-3 text-cyan-400" />}
                  HD-1 (Backup)
                </button>
              </div>
            </div>
          </div>

          {/* Subtitle Master Toggle */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-pink-400" />
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-zinc-200">Subtitles & Captions</div>
                  {hasSubtitles ? (
                    <span className="bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      CC LOADED
                    </span>
                  ) : (
                    <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                      CC AUTO
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-400">Display timed anime subtitles without fade delays</div>
              </div>
            </div>
            <button
              onClick={() => onUpdateSubtitleSettings({ visible: !subtitleSettings.visible })}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative ${
                subtitleSettings.visible ? 'bg-pink-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  subtitleSettings.visible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Subtitle Customization Panel (Range Bars & Colors) */}
          {subtitleSettings.visible && (
            <div className="py-3.5 bg-zinc-950/80 rounded-2xl p-3.5 my-1.5 border border-zinc-800 flex flex-col gap-3.5 shadow-inner">
              {/* Live Preview Box */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-pink-400" />
                    Live Subtitle Preview
                  </span>
                  <span className="text-zinc-500 font-mono">Raw instant sync</span>
                </div>
                <div className="w-full h-18 bg-zinc-900/90 rounded-xl border border-zinc-800/80 flex items-center justify-center p-2 overflow-hidden relative">
                  <div
                    className="border px-3 py-1 text-center font-bold tracking-wide select-none transition-none"
                    style={{
                      fontSize: `${subtitleSettings.size}px`,
                      borderRadius: `${subtitleSettings.borderRadius}px`,
                      backgroundColor: previewBgRgba,
                      borderColor: 'rgba(255, 255, 255, 0.18)',
                      color: previewTextColor,
                    }}
                  >
                    Ore wa Kaizoku Ou ni naru! (EP 23)
                  </div>
                </div>
              </div>

              {/* Range 1: Subtitle Size */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Subtitle Size</span>
                  <span className="font-mono text-pink-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                    {subtitleSettings.size}px
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={30}
                  step={1}
                  value={subtitleSettings.size}
                  onChange={(e) => onUpdateSubtitleSettings({ size: Number(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Small (10px)</span>
                  <span>Default (14px)</span>
                  <span>Large (30px)</span>
                </div>
              </div>

              {/* Range 2: Height Position (Bottom Offset) */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300 flex items-center gap-1">
                    <MoveVertical className="w-3 h-3 text-zinc-400" />
                    Height Position (Offset)
                  </span>
                  <span className="font-mono text-cyan-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                    {subtitleSettings.heightPosition}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={2}
                  value={subtitleSettings.heightPosition}
                  onChange={(e) => onUpdateSubtitleSettings({ heightPosition: Number(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Bottom (0px)</span>
                  <span>Middle (50px)</span>
                  <span>High (100px)</span>
                </div>
              </div>

              {/* Range 3: Border Radius */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Border Radius</span>
                  <span className="font-mono text-amber-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                    {subtitleSettings.borderRadius}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={subtitleSettings.borderRadius}
                  onChange={(e) => onUpdateSubtitleSettings({ borderRadius: Number(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Sharp (0px)</span>
                  <span>Rounded (8px)</span>
                  <span>Pill (24px)</span>
                </div>
              </div>

              {/* Range 4: Background Opacity */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Background Opacity</span>
                  <span className="font-mono text-emerald-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                    {subtitleSettings.bgOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={subtitleSettings.bgOpacity}
                  onChange={(e) => onUpdateSubtitleSettings({ bgOpacity: Number(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Transparent (0%)</span>
                  <span>Semi (50%)</span>
                  <span>Solid (100%)</span>
                </div>
              </div>

              {/* Background Color Selector */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-xs font-semibold text-zinc-300">Background Color</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {BG_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => onUpdateSubtitleSettings({ backgroundColor: preset.hex })}
                      className={`h-8 rounded-lg border flex items-center justify-center gap-1 text-[10px] font-bold transition-all relative overflow-hidden ${
                        subtitleSettings.backgroundColor === preset.hex
                          ? 'border-pink-500 ring-2 ring-pink-500/40 text-white shadow-md'
                          : 'border-zinc-700 hover:border-zinc-500 text-zinc-400'
                      }`}
                      style={{
                        backgroundColor: preset.hex === 'none' ? 'transparent' : preset.hex,
                        backgroundImage: preset.hex === 'none' ? 'repeating-linear-gradient(45deg, #27272a 0, #27272a 3px, #18181b 3px, #18181b 6px)' : undefined,
                      }}
                      title={preset.name}
                    >
                      {preset.hex === 'none' ? (
                        <span className="text-[9px] text-zinc-300 tracking-tight">None</span>
                      ) : (
                        subtitleSettings.backgroundColor === preset.hex && <Check className="w-3 h-3 text-pink-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Color Selector */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-zinc-300">Text Color</span>
                <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 gap-1">
                  {(['white', 'yellow', 'cyan'] as const).map((col) => (
                    <button
                      key={col}
                      onClick={() => onUpdateSubtitleSettings({ color: col })}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                        subtitleSettings.color === col
                          ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          col === 'white' ? 'bg-white' : col === 'yellow' ? 'bg-yellow-300' : 'bg-cyan-300'
                        }`}
                      />
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitle Sync Timing Offset */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <Info className="w-3 h-3 text-zinc-500" />
                  <span>Sync Timing:</span>
                  <span className="text-zinc-200 font-mono font-bold">
                    {subtitleSettings.syncOffset >= 0
                      ? `+${subtitleSettings.syncOffset.toFixed(1)}s`
                      : `${subtitleSettings.syncOffset.toFixed(1)}s`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      onUpdateSubtitleSettings({
                        syncOffset: Math.max((subtitleSettings.syncOffset || 0) - 0.5, -5),
                      })
                    }
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px] transition-colors"
                  >
                    -0.5s
                  </button>
                  {subtitleSettings.syncOffset !== 0 && (
                    <button
                      onClick={() => onUpdateSubtitleSettings({ syncOffset: 0 })}
                      className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold text-[10px] transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() =>
                      onUpdateSubtitleSettings({
                        syncOffset: Math.min((subtitleSettings.syncOffset || 0) + 0.5, 5),
                      })
                    }
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px] transition-colors"
                  >
                    +0.5s
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Auto Next Video Option */}
          <div className="py-3 flex items-center justify-between border-t border-zinc-800/80">
            <div className="flex items-center gap-2">
              <FastForward className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">Auto Next Video</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    subtitleSettings.autoNext ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10'
                  }`}>
                    {subtitleSettings.autoNext ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">Advance to next video when current finished</div>
              </div>
            </div>
            <button
              id="toggle-auto-next"
              onClick={() =>
                onUpdateSubtitleSettings({
                  autoNext: !subtitleSettings.autoNext,
                })
              }
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                subtitleSettings.autoNext ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  subtitleSettings.autoNext ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Terminal / Debugger Icon Toggle */}
          <div className="py-3 flex items-center justify-between border-t border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">Video Debugger Icon</div>
                <div className="text-[10px] text-zinc-400">Show terminal diagnostic button in player</div>
              </div>
            </div>
            <button
              id="toggle-terminal-icon"
              onClick={() =>
                onUpdateSubtitleSettings({
                  showTerminalIcon: !subtitleSettings.showTerminalIcon,
                })
              }
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                subtitleSettings.showTerminalIcon ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  subtitleSettings.showTerminalIcon ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Share Section Title */}
        <div className="mt-3 mb-2 flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Share To</span>
        </div>

        {/* Action icons row */}
        <div className="grid grid-cols-5 gap-2 my-2">
          {shareItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={item.action}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
              >
                <div className={`w-11 h-11 rounded-full ${item.color} border flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 font-medium truncate w-full text-center">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Direct Link box */}
        <div className="mt-3 p-2 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400 font-mono truncate">{shareUrl}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const mountTarget = (typeof document !== 'undefined' && document.fullscreenElement) || (typeof document !== 'undefined' && document.body) || null;
  if (!mountTarget) return drawerContent;

  return createPortal(drawerContent, mountTarget);
};
