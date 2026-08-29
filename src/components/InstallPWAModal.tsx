import React from 'react';
import { Download, DraftingCompass, X, Sparkles, Share, PlusSquare, ExternalLink, Info } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPWAModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstallSuccess?: () => void;
}

export const InstallPWAModal: React.FC<InstallPWAModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallSuccess,
}) => {
  if (!isOpen) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isInIframe = window.self !== window.top;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          if (onInstallSuccess) onInstallSuccess();
          onClose();
        }
      } catch (err) {
        console.error('PWA install error:', err);
      }
    } else if (isInIframe) {
      window.open(window.location.href, '_blank');
    } else {
      window.open(window.location.href, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 text-white shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-[2px] flex items-center justify-center shadow-xl shadow-pink-500/20 mb-4 shrink-0">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <DraftingCompass className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Install App Experience</span>
          </div>

          <h2 className="text-xl font-bold tracking-tight mb-2">
            Install Ani-Tok App
          </h2>
          <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
            Install Ani-Tok to watch full screen short anime without browser frame, faster loading, and app launcher support!
          </p>
        </div>

        {/* Options depending on context */}
        {deferredPrompt ? (
          <div className="space-y-3">
            <button
              onClick={handleInstallClick}
              className="w-full py-3.5 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 font-bold text-sm text-white shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4.5 h-4.5" />
              <span>Install Ani-Tok PWA Now</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 px-5 rounded-xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          </div>
        ) : isInIframe ? (
          <div className="space-y-4">
            <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3.5 text-xs text-pink-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
              <span>You are viewing inside an embedded preview iframe. Browsers require opening in a full new tab to install as a native App.</span>
            </div>
            <button
              onClick={handleOpenNewTab}
              className="w-full py-3.5 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 font-bold text-sm text-white shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <ExternalLink className="w-4.5 h-4.5" />
              <span>Open in New Tab to Install</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-5 rounded-xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-4">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 space-y-2.5">
              <p className="font-semibold text-white">To install on iOS Safari:</p>
              <div className="flex items-center gap-2.5">
                <Share className="w-4 h-4 text-pink-400 shrink-0" />
                <span>1. Tap the <strong className="text-white">Share</strong> icon in Safari toolbar.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <PlusSquare className="w-4 h-4 text-pink-400 shrink-0" />
                <span>2. Select <strong className="text-white">Add to Home Screen</strong>.</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 font-bold text-sm text-white transition-colors"
            >
              Got It
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 space-y-2">
              <p className="font-semibold text-white">Manual Install Instructions:</p>
              <p>In Chrome/Edge menu (⋮ or ⋯ top-right):</p>
              <p className="text-pink-300 font-medium">Select &quot;Install Ani-Tok&quot; or &quot;Save & Share&quot; &rarr; &quot;Install page as app&quot;</p>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={handleOpenNewTab}
                className="w-full py-3.5 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 font-bold text-sm text-white shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <ExternalLink className="w-4.5 h-4.5" />
                <span>Open Direct App Window</span>
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 px-5 rounded-xl bg-white/5 hover:bg-white/10 font-semibold text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
