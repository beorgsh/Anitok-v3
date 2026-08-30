import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, CheckCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [ep, setEp] = useState('1');
  const [success, setSuccess] = useState(false);

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSuccess(true);
    toast.success('Short video submitted successfully!', {
      icon: '✨',
      duration: 2500,
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
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="upload-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-zinc-200"
          onClick={onClose}
        >
          <motion.div 
            key="upload-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-sm bg-zinc-900/98 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {success ? (
              <div className="flex flex-col items-center py-8 text-center animate-scale-up">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-3">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-zinc-100">Video Published!</h3>
                <p className="text-xs text-zinc-400 mt-1">Your anime short video clip has been added to the feed stream.</p>
              </div>
            ) : (
              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <h3 className="font-bold text-sm text-zinc-100">Upload Anime Short Clip</h3>
                </div>

                <div className="p-6 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center bg-zinc-950/60 cursor-pointer hover:border-zinc-700 transition-colors">
                  <UploadCloud className="w-7 h-7 text-zinc-400 mb-2" />
                  <p className="text-xs font-semibold text-zinc-300">Drag & drop video clip or click to browse</p>
                  <p className="text-[10px] text-zinc-500 mt-1">MP4, WebM or M3U8 link up to 60s</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1 block">Anime Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Solo Leveling Season 2"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-200 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 mb-1 block">Episode Number</label>
                  <input
                    type="number"
                    value={ep}
                    onChange={(e) => setEp(e.target.value)}
                    className="w-full bg-zinc-950 text-xs text-zinc-200 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md active:scale-95 disabled:opacity-40 transition-all mt-1"
                >
                  Post Short Video
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
