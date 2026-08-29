import React, { useState } from 'react';
import { Star, Tv, MessageSquare, Send, Sparkles, Film, CheckCircle2 } from 'lucide-react';
import { AnimeItem, Comment } from '../types/anime';

interface DesktopRightPanelProps {
  anime: AnimeItem | null;
  currentEp: number;
  server: 'hd-1' | 'hd-2';
  onChangeEp: (ep: number) => void;
  onChangeServer: (s: 'hd-1' | 'hd-2') => void;
  prefetchPage: number;
}

const DESKTOP_COMMENTS: Comment[] = [
  {
    id: 'dc1',
    user: 'CyberSamurai',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    text: 'Watching on desktop, HLS playback is butter smooth!',
    time: '10m ago',
    likes: 45,
    isLiked: true,
  },
  {
    id: 'dc2',
    user: 'NekoGirl_X',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    text: 'This episode animation is fire! 🔥 Stream loaded instant.',
    time: '25m ago',
    likes: 29,
    isLiked: false,
  },
];

export const DesktopRightPanel: React.FC<DesktopRightPanelProps> = ({
  anime,
  currentEp,
  server,
  onChangeEp,
  onChangeServer,
  prefetchPage,
}) => {
  const [comments, setComments] = useState<Comment[]>(DESKTOP_COMMENTS);
  const [newComment, setNewComment] = useState<string>('');

  if (!anime) {
    return (
      <aside className="w-80 bg-gray-950/80 backdrop-blur-xl border-l border-gray-800 p-5 hidden xl:flex flex-col items-center justify-center text-gray-500 text-xs">
        Select an anime to view details
      </aside>
    );
  }

  const genres = anime.terms_by_type?.genre || ['Anime'];
  const episodeCount = parseInt(anime.episodes || '12') || 12;

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setComments([
      {
        id: `dc_${Date.now()}`,
        user: 'You (Desktop)',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        text: newComment.trim(),
        time: 'Just now',
        likes: 0,
        isLiked: false,
      },
      ...comments,
    ]);
    setNewComment('');
  };

  return (
    <aside className="w-80 bg-gray-950/90 backdrop-blur-xl border-l border-gray-800/80 p-5 hidden xl:flex flex-col justify-between select-none z-30 shrink-0 overflow-y-auto">
      <div className="flex flex-col gap-5">
        {/* Anime Title & Poster Header */}
        <div className="flex gap-3 items-center">
          <img
            src={anime.poster}
            alt={anime.title}
            className="w-16 h-22 object-cover rounded-xl shadow-lg ring-1 ring-white/10 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              {anime.status || 'Airing'}
            </div>
            <h3 className="text-sm font-black text-white line-clamp-2 leading-tight">
              {anime.title}
            </h3>
            {anime.score && (
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 mt-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {anime.score} / 10
              </div>
            )}
          </div>
        </div>

        {/* Prefetch status notice */}
        <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-300">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> TikTok Lazy Loader Active
          </span>
          <span className="font-mono text-[10px] bg-emerald-900/60 px-1.5 py-0.5 rounded">
            Prefetch Page {prefetchPage}
          </span>
        </div>

        {/* Episode Picker Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Film className="w-4 h-4 text-cyan-400" /> Episodes ({episodeCount})
            </h4>
            <div className="flex gap-1">
              <button
                onClick={() => onChangeServer('hd-1')}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  server === 'hd-1' ? 'bg-cyan-500 text-black font-bold' : 'bg-gray-900 text-gray-400'
                }`}
              >
                HD 1
              </button>
              <button
                onClick={() => onChangeServer('hd-2')}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  server === 'hd-2' ? 'bg-cyan-500 text-black font-bold' : 'bg-gray-900 text-gray-400'
                }`}
              >
                HD 2
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {Array.from({ length: Math.min(episodeCount, 24) }, (_, i) => i + 1).map((ep) => (
              <button
                key={ep}
                onClick={() => onChangeEp(ep)}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                  ep === currentEp
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                    : 'bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800'
                }`}
              >
                Ep {ep}
              </button>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div className="flex flex-wrap gap-1">
          {genres.map((g, idx) => (
            <span
              key={idx}
              className="text-[10px] font-semibold text-gray-300 bg-gray-900 border border-gray-800 px-2.5 py-1 rounded-full"
            >
              #{g}
            </span>
          ))}
        </div>

        {/* Interactive Desktop Comments */}
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
          <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-pink-400" /> Live Discussion
          </h4>

          <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2 text-xs">
                <img src={c.avatar} alt={c.user} className="w-7 h-7 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-300">{c.user}</span>
                  <p className="text-gray-400 text-[11px] leading-tight">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment Form */}
      <form onSubmit={handlePost} className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Comment on desktop..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1 bg-gray-900 text-xs text-white placeholder-gray-500 px-3 py-2 rounded-xl border border-gray-800 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          className="px-3 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
