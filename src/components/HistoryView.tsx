import React, { useEffect, useState } from 'react';
import { Play, Trash2, Clock, CheckCircle2, RotateCcw, Film, ArrowLeft, X, Bell, Sparkles } from 'lucide-react';
import { AnimeItem, ServerType, WatchHistoryItem } from '../types/anime';
import { getWatchHistory, clearWatchHistory, removeWatchHistoryItem } from '../services/watchHistory';
import toast from 'react-hot-toast';

interface HistoryViewProps {
  onSelectAnime: (anime: AnimeItem, episode?: number, startTime?: number, isDub?: boolean, server?: ServerType) => void;
  onBackToFeed: () => void;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Recently';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelectAnime, onBackToFeed }) => {
  const [historyList, setHistoryList] = useState<WatchHistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'watching' | 'completed'>('all');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  const loadHistory = () => {
    setHistoryList(getWatchHistory());
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearAll = () => {
    clearWatchHistory();
    setHistoryList([]);
    setIsEditMode(false);
    toast.success('Watch history cleared', {
      icon: '🗑️',
      style: {
        background: 'rgba(24, 24, 27, 0.95)',
        color: '#fff',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        fontSize: '12px',
      },
    });
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeWatchHistoryItem(id);
    setHistoryList((prev) => prev.filter((item) => item.id !== id));
    toast.success('Item deleted', {
      icon: '🗑️',
      style: {
        background: 'rgba(24, 24, 27, 0.95)',
        color: '#fff',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        fontSize: '12px',
      },
    });
  };

  const filteredHistory = historyList.filter((item) => {
    const progressPct =
      item.duration > 0 ? Math.min(100, Math.max(0, (item.currentTime / item.duration) * 100)) : 0;
    if (filter === 'watching') return progressPct < 90;
    if (filter === 'completed') return progressPct >= 90;
    return true;
  });

  return (
    <div className="w-full h-full bg-zinc-950 text-white flex flex-col overflow-hidden pb-14 sm:pb-16 select-none">
      {/* Top Header - TikTok Notification Style */}
      <div className="px-3.5 py-3 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              id="btn-history-back"
              onClick={onBackToFeed}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer active:scale-90"
              title="Back to Feed"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-zinc-100 flex items-center gap-2">
                <span>Notifications & History</span>
                {historyList.length > 0 && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-400">
                    {historyList.length}
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {historyList.length > 0 && (
              <>
                <button
                  id="btn-toggle-delete-mode"
                  onClick={() => setIsEditMode((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isEditMode
                      ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80'
                  }`}
                  title="Toggle Delete Mode"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'Done' : 'Delete'}</span>
                </button>

                {isEditMode && (
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/40 rounded-full text-xs font-semibold transition-colors cursor-pointer animate-fade-in"
                    title="Clear all activity"
                  >
                    <span>Clear All</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filter Pills (TikTok Activity style) */}
        {historyList.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-zinc-100 text-zinc-900 shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Activity ({historyList.length})
            </button>
            <button
              onClick={() => setFilter('watching')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'watching'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'completed'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Completed
            </button>
          </div>
        )}
      </div>

      {/* Notifications / Activity Feed */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 overscroll-contain">
        {filteredHistory.length === 0 ? (
          <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 my-auto">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-500 mb-3 shadow-inner">
              <Bell className="w-8 h-8 text-pink-400/70" />
            </div>
            <h3 className="text-base font-bold text-zinc-200">No Activity Yet</h3>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-xs leading-relaxed">
              When you watch episodes, your notifications and watch progress will show up in this activity feed.
            </p>
            <button
              onClick={onBackToFeed}
              className="mt-5 px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-full text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center gap-2 active:scale-95 transition-transform cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Watch Feed</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl mx-auto divide-y divide-zinc-800/40">
            {filteredHistory.map((item) => {
              const progressPct =
                item.duration > 0 ? Math.min(100, Math.max(0, (item.currentTime / item.duration) * 100)) : 0;
              const isFinished = progressPct > 90;

              return (
                <div
                  key={item.id}
                  onClick={() =>
                    onSelectAnime(
                      item.anime,
                      item.episode || 1,
                      item.currentTime || 0,
                      item.isDub || false,
                      item.server || 'hd-2'
                    )
                  }
                  className="group relative pt-3 first:pt-0 p-2.5 rounded-2xl hover:bg-zinc-900/70 flex items-center gap-3.5 cursor-pointer transition-all duration-150 active:scale-[0.99]"
                >
                  {/* Delete Button shown when isEditMode is true */}
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, item.id)}
                      className="w-7 h-7 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/40 flex items-center justify-center shrink-0 transition-all cursor-pointer animate-scale-in"
                      title="Delete activity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* ROUND Avatar (TikTok Profile Notification Style) with Gradient Magenta, White & Cyan Border */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-fuchsia-500 via-white to-cyan-400 shadow-md flex items-center justify-center overflow-hidden">
                      <img
                        src={item.anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150'}
                        alt={item.anime.title}
                        className="w-full h-full rounded-full object-cover bg-zinc-900"
                        loading="lazy"
                      />
                    </div>

                    {/* Corner Activity Badge on the Round Avatar */}
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-zinc-950 shadow-sm ${
                        isFinished ? 'bg-emerald-500 text-white' : 'bg-pink-500 text-white'
                      }`}
                    >
                      {isFinished ? (
                        <CheckCircle2 className="w-2.5 h-2.5 text-white stroke-[3]" />
                      ) : (
                        <Play className="w-2 h-2 fill-current text-white ml-0.2" />
                      )}
                    </div>
                  </div>

                  {/* Notification Activity Text (TikTok Notification Format) */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm text-zinc-300 leading-snug">
                      <span className="font-bold text-zinc-100 group-hover:text-pink-400 transition-colors">
                        {item.anime.title}
                      </span>{' '}
                      <span className="text-zinc-400">
                        {isFinished
                          ? `completed Episode ${item.episode || 1}`
                          : `left off at ${formatDuration(item.currentTime)} in Episode ${item.episode || 1}`}
                      </span>
                    </div>

                    {/* Meta line: Dub/Sub, server, and timestamp */}
                    <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        EP {item.episode || 1}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          item.isDub ? 'bg-amber-950/80 text-amber-300' : 'bg-cyan-950/80 text-cyan-300'
                        }`}
                      >
                        {item.isDub ? 'DUB' : 'SUB'}
                      </span>
                      <span className="text-zinc-500 text-[10px]">{formatRelativeTime(item.updatedAt)}</span>
                    </div>

                    {/* Mini Progress Bar Line */}
                    <div className="w-full max-w-[220px] h-1 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFinished ? 'bg-emerald-500' : 'bg-pink-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

