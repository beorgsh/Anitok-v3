import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, Type, Palette, Info, Check, Sparkles, MoveVertical, Globe, Settings2, FastForward } from 'lucide-react';
import { SubtitleSettings, AnimeItem } from '../types/anime';

interface SubtitleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  anime: AnimeItem;
  subtitleSettings: SubtitleSettings;
  onUpdateSubtitleSettings: (settings: Partial<SubtitleSettings>) => void;
  hasSubtitles?: boolean;
}

const COLOR_PRESETS = [
  { name: 'white', hex: '#ffffff' },
  { name: 'yellow', hex: '#fef08a' },
  { name: 'cyan', hex: '#67e8f9' },
] as const;

const BG_COLOR_PRESETS = [
  { name: 'None', hex: 'none' },
  { name: 'Pure Black', hex: '#000000' },
  { name: 'Dark Zinc', hex: '#18181b' },
  { name: 'Midnight', hex: '#09090b' },
  { name: 'Deep Violet', hex: '#1e1b4b' },
  { name: 'Slate Blue', hex: '#0f172a' },
];

export const SubtitleSettingsModal: React.FC<SubtitleSettingsModalProps> = ({
  isOpen,
  onClose,
  anime,
  subtitleSettings,
  onUpdateSubtitleSettings,
  hasSubtitles = true,
}) => {
  if (!isOpen) return null;

  // Mock subtitle tracks for the selected anime (or dynamically generated/derived)
  const availableTracks = [
    { id: 'en-us', label: 'English (US) [Official CC]', lang: 'ENG', active: true },
    { id: 'es-la', label: 'Español (Latino) [Auto-Sync]', lang: 'ESP', active: false },
    { id: 'pt-br', label: 'Português (Brasil) [Subbed]', lang: 'POR', active: false },
    { id: 'off', label: 'None / Disabled', lang: 'OFF', active: !subtitleSettings.visible },
  ];

  const handleTrackSelect = (trackId: string) => {
    if (trackId === 'off') {
      onUpdateSubtitleSettings({ visible: false });
    } else {
      onUpdateSubtitleSettings({ visible: true });
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-55 flex flex-col justify-end bg-black/80 backdrop-blur-xs text-zinc-100 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-zinc-900/98 border border-white/20 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto shadow-[0_0_25px_rgba(255,255,255,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabbing Handle */}
        <div className="w-10 h-1 bg-white/40 rounded-full mx-auto mb-3" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/20">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4.5 h-4.5 text-white animate-spin-slow" />
            <h3 className="font-extrabold text-sm text-white">CC & Subtitle Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 border border-white/20 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Subtitle Toggle */}
        <div className="py-3 flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-pink-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">Subtitles & Captions</span>
                {hasSubtitles ? (
                  <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    CC ACTIVE
                  </span>
                ) : (
                  <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                    OFFLINE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">Display timed subtitle overlays instantaneously</p>
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

        {subtitleSettings.visible && (
          <div className="flex flex-col gap-4 mt-2">
            {/* Live Preview Box */}
            <div className="bg-zinc-950/80 rounded-2xl p-3 border border-white/20">
              <div className="flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  Live Font & Background Preview
                </span>
                <span className="text-zinc-400">Live Feedback</span>
              </div>
              <div className="w-full h-16 bg-zinc-900 rounded-xl flex items-center justify-center p-2 relative overflow-hidden border border-white/10">
                <div
                  className="px-3 py-1 text-center font-bold tracking-wide break-words max-w-[90%]"
                  style={{
                    fontSize: `${subtitleSettings.size}px`,
                    color: subtitleSettings.color === 'yellow' ? '#fef08a' : subtitleSettings.color === 'cyan' ? '#67e8f9' : '#ffffff',
                    backgroundColor: subtitleSettings.backgroundColor === 'none' ? 'transparent' : subtitleSettings.backgroundColor,
                    borderRadius: `${subtitleSettings.borderRadius}px`,
                    opacity: (subtitleSettings.bgOpacity ?? 85) / 100,
                  }}
                >
                  Subtitle Track Preview
                </div>
              </div>
            </div>

            {/* Customization Sliders */}
            <div className="bg-zinc-950/40 rounded-2xl p-3 border border-white/20 flex flex-col gap-3">
              {/* Font Size slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-semibold">Font Size</span>
                  <span className="text-[11px] font-mono font-bold text-zinc-400">{subtitleSettings.size}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={subtitleSettings.size}
                  onChange={(e) => onUpdateSubtitleSettings({ size: Number(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              {/* Vertical Position slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-semibold flex items-center gap-1">
                    <MoveVertical className="w-3.5 h-3.5 text-zinc-400" />
                    Vertical Lift Height
                  </span>
                  <span className="text-[11px] font-mono font-bold text-zinc-400">{subtitleSettings.heightPosition}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={subtitleSettings.heightPosition}
                  onChange={(e) => onUpdateSubtitleSettings({ heightPosition: Number(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              {/* Background Opacity slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-semibold">Background Opacity</span>
                  <span className="text-[11px] font-mono font-bold text-zinc-400">{subtitleSettings.bgOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={subtitleSettings.bgOpacity}
                  onChange={(e) => onUpdateSubtitleSettings({ bgOpacity: Number(e.target.value) })}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              {/* Text Color Selector */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                  <Palette className="w-4 h-4 text-pink-400" /> Color
                </span>
                <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 gap-1">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col.name}
                      onClick={() => onUpdateSubtitleSettings({ color: col.name })}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase transition-all flex items-center gap-1 ${
                        subtitleSettings.color === col.name
                          ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.hex }} />
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subtitle Sync Offset Controls */}
            <div className="flex items-center justify-between bg-zinc-950/60 p-3 rounded-2xl border border-white/20">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                <Info className="w-4 h-4 text-zinc-400" />
                <span>Sync Offset:</span>
                <span className="text-pink-400 font-mono font-extrabold">
                  {subtitleSettings.syncOffset >= 0
                    ? `+${subtitleSettings.syncOffset.toFixed(1)}s`
                    : `${subtitleSettings.syncOffset.toFixed(1)}s`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onUpdateSubtitleSettings({
                      syncOffset: Math.max((subtitleSettings.syncOffset || 0) - 0.5, -5),
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-xs border border-white/10"
                >
                  -0.5s
                </button>
                {subtitleSettings.syncOffset !== 0 && (
                  <button
                    onClick={() => onUpdateSubtitleSettings({ syncOffset: 0 })}
                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-400 font-bold text-xs border border-white/10"
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
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-xs border border-white/10"
                >
                  +0.5s
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auto Next Video Option */}
        <div className="py-3 flex items-center justify-between border-t border-white/20 mt-3">
          <div className="flex items-center gap-2">
            <FastForward className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">Auto Next Video</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  subtitleSettings.autoNext ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10'
                }`}>
                  {subtitleSettings.autoNext ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Automatically play the next video when current finishes</p>
            </div>
          </div>
          <button
            onClick={() => onUpdateSubtitleSettings({ autoNext: !subtitleSettings.autoNext })}
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

        {/* Subtitle Tracks List Section */}
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2.5">
            <Globe className="w-4 h-4 text-pink-400" />
            <span>Available Subtitle Languages</span>
          </div>

          <div className="flex flex-col gap-2">
            {availableTracks.map((track) => (
              <div
                key={track.id}
                onClick={() => handleTrackSelect(track.id)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  (track.id === 'off' && !subtitleSettings.visible) || (track.id !== 'off' && subtitleSettings.visible && track.active)
                    ? 'bg-pink-950/40 border-pink-500/50 text-pink-200'
                    : 'bg-zinc-950/40 border-white/15 text-zinc-300 hover:border-white/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-white/15 text-[10px] font-extrabold flex items-center justify-center text-zinc-300">
                    {track.lang}
                  </span>
                  <span className="text-xs font-semibold">{track.label}</span>
                </div>
                {((track.id === 'off' && !subtitleSettings.visible) || (track.id !== 'off' && subtitleSettings.visible && track.active)) && (
                  <Check className="w-4 h-4 text-pink-400 stroke-[3]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const mountTarget =
    (typeof document !== 'undefined' && document.fullscreenElement) ||
    (typeof document !== 'undefined' && document.body) ||
    null;
  if (!mountTarget) return modalContent;

  return createPortal(modalContent, mountTarget);
};
