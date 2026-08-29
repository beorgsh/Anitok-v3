import React, { useState } from 'react';
import { X, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { auth, signOut } from '../lib/firebase';
import { setIsAuthenticatedCached, saveCachedUserProfile, saveCachedAuthUser } from '../lib/cookies';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, userProfile }) => {
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      setIsAuthenticatedCached(false);
      saveCachedUserProfile(null);
      saveCachedAuthUser(null);
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to logout', error);
    } finally {
      setIsLoggingOut(false);
      setIsConfirmingLogout(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm bg-zinc-950 rounded-2xl border border-zinc-800 p-6 flex flex-col items-center gap-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {userProfile && (
          <div className="flex flex-col items-center gap-4 mt-2">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-zinc-900 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              <img 
                src={`https://api.dicebear.com/7.x/${userProfile.avatarStyle || 'adventurer'}/svg?seed=${userProfile.avatarSeed}`} 
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">{userProfile.username}</h2>
              <p className="text-xs text-zinc-400 font-medium">Logged in</p>
            </div>
          </div>
        )}

        <div className="w-full mt-4">
          {!isConfirmingLogout ? (
            <button
              onClick={() => setIsConfirmingLogout(true)}
              className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-red-400 font-bold text-sm hover:bg-zinc-800 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-200 leading-relaxed">
                  Are you sure you want to sign out? Your watch history and likes are synced to the cloud.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmingLogout(false)}
                  disabled={isLoggingOut}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors flex items-center justify-center"
                >
                  {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Sign Out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
