import React, { useState } from 'react';
import { Dice5, Check } from 'lucide-react';
import { syncProfileToFirebase } from '../lib/firebaseStore';
import { saveCachedUserProfile } from '../lib/cookies';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: (profile: any) => void;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onComplete }) => {
  const [username, setUsername] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleRandomizeAvatar = () => {
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    const newProfile = {
      username: username.trim(),
      avatarStyle: 'adventurer',
      avatarSeed
    };
    try {
      saveCachedUserProfile(newProfile);
      await syncProfileToFirebase(newProfile);
      onComplete(newProfile);
    } catch (error) {
      console.error('Failed to save profile', error);
      // Still complete if local save succeeded
      onComplete(newProfile);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm bg-zinc-950 rounded-2xl border border-zinc-800 p-6 flex flex-col items-center gap-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2 w-full">
          <h2 className="text-2xl font-black text-white tracking-tight">Create Profile</h2>
          <p className="text-sm text-zinc-400 font-medium">
            Set up your identity to continue.
          </p>
        </div>

        <form onSubmit={handleSave} className="w-full space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-zinc-900 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              <img 
                src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`} 
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            
            <button
              type="button"
              onClick={handleRandomizeAvatar}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-sm font-bold text-white hover:bg-zinc-800 transition-colors"
            >
              <Dice5 className="w-4 h-4" />
              Randomize Avatar
            </button>
          </div>

          <div className="space-y-1 w-full">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Username"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all text-center font-bold"
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : (
              <>
                <Check className="w-5 h-5" />
                Complete Setup
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
