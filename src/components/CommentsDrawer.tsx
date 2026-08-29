import React, { useState } from 'react';
import { X, Heart, Send, Smile, MessageSquare } from 'lucide-react';
import { AnimeItem, Comment } from '../types/anime';

interface CommentsDrawerProps {
  anime: AnimeItem;
  currentEp: number;
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'c1',
    user: 'OtakuRider99',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    text: 'This animation quality in this episode is absolutely top-tier! 🔥',
    time: '2h ago',
    likes: 1420,
    isLiked: false,
  },
  {
    id: 'c2',
    user: 'SakuraVibes',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    text: 'Can we talk about that cliffhanger ending though?! Episode 2 is gonna be insane! 😱✨',
    time: '5h ago',
    likes: 834,
    isLiked: true,
  },
  {
    id: 'c3',
    user: 'ZenithMain',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100',
    text: 'Subbed release came out so fast. Thanks TikTok Anime stream!',
    time: '1d ago',
    likes: 312,
    isLiked: false,
  },
  {
    id: 'c4',
    user: 'KageBunshin',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    text: 'The main protagonist is so overpowered, I love it! ⚡',
    time: '2d ago',
    likes: 95,
    isLiked: false,
  },
];

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  anime,
  currentEp,
  isOpen,
  onClose,
}) => {
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [inputText, setInputText] = useState<string>('');
  const [selectedEp, setSelectedEp] = useState<number>(currentEp);

  if (!isOpen) return null;

  const handleToggleLike = (id: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            likes: c.isLiked ? c.likes - 1 : c.likes + 1,
            isLiked: !c.isLiked,
          };
        }
        return c;
      })
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newComment: Comment = {
      id: `c_${Date.now()}`,
      user: 'You (AnimeFan)',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      text: inputText.trim(),
      time: 'Just now',
      likes: 0,
      isLiked: false,
    };

    setComments([newComment, ...comments]);
    setInputText('');
  };

  return (
    <div
      id={`comments-drawer-${anime.id}`}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto h-[75vh] bg-zinc-900/98 backdrop-blur-2xl border-t border-zinc-800 rounded-t-3xl flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top grab bar handle */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-2 mt-3" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/90">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            <h3 className="font-bold text-sm text-zinc-100">
              {comments.length} Comments
            </h3>
            <span className="text-[11px] text-zinc-400 font-semibold bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
              Ep {selectedEp}
            </span>
          </div>

          <button
            id={`btn-close-comments-${anime.id}`}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Episode Filter Bar */}
        <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">Filter:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((ep) => (
            <button
              key={ep}
              onClick={() => setSelectedEp(ep)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-all ${
                selectedEp === ep
                  ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              Ep {ep}
            </button>
          ))}
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <img
                src={comment.avatar}
                alt={comment.user}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-700 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-300">
                    {comment.user}
                  </span>
                  <span className="text-[10px] text-zinc-500">{comment.time}</span>
                </div>
                <p className="text-xs text-zinc-200 mt-1 leading-relaxed break-words">
                  {comment.text}
                </p>
                <div className="flex items-center gap-4 mt-1.5">
                  <button
                    onClick={() => handleToggleLike(comment.id)}
                    className="text-[11px] text-zinc-400 hover:text-pink-400 font-medium flex items-center gap-1"
                  >
                    Reply
                  </button>
                </div>
              </div>

              {/* Like Comment */}
              <button
                onClick={() => handleToggleLike(comment.id)}
                className="flex flex-col items-center justify-start text-zinc-400 hover:text-pink-500 shrink-0 pt-0.5"
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-all ${
                    comment.isLiked ? 'fill-pink-500 text-pink-500 scale-110' : 'hover:scale-110'
                  }`}
                />
                <span className="text-[10px] text-zinc-400 mt-0.5">{comment.likes}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Add Comment Input Bar */}
        <form
          onSubmit={handleAddComment}
          className="p-3 border-t border-zinc-800 bg-zinc-900 flex items-center gap-2"
        >
          <img
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"
            alt="You"
            className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-700"
          />
          <div className="flex-1 relative flex items-center">
            <input
              id={`input-add-comment-${anime.id}`}
              type="text"
              placeholder={`Add comment for Ep ${selectedEp}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 px-3 py-2 rounded-full border border-zinc-800 focus:outline-none focus:border-zinc-600 transition-colors pr-9"
            />
            <button
              type="button"
              onClick={() => setInputText((prev) => prev + ' 🔥')}
              className="absolute right-3 text-zinc-400 hover:text-zinc-200"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-8 h-8 rounded-full bg-pink-500 hover:bg-pink-600 disabled:opacity-40 flex items-center justify-center text-white font-bold active:scale-90 transition-transform shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
