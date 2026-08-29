import React, { useState, useEffect } from 'react';
import { Heart, Settings, Play, LogIn, LogOut, Check } from 'lucide-react';
import { AnimeItem } from '../types/anime';
import { getWatchHistory } from '../services/watchHistory';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../lib/firebase';
import { syncProfileToFirebase, fetchUserDataFromFirebase } from '../lib/firebaseStore';
import { getCachedUserProfile, saveCachedUserProfile, StoredUserProfile } from '../lib/cookies';

interface ProfileViewProps {
  likedAnimeList: AnimeItem[];
  savedAnimeList: AnimeItem[];
  onSelectAnime: (anime: AnimeItem) => void;
  onBackToFeed: () => void;
  userProfile?: StoredUserProfile | null;
  onUpdateProfile?: (profile: StoredUserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  likedAnimeList,
  onSelectAnime,
  onBackToFeed,
  userProfile: propProfile,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'liked' | 'history'>('liked');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initialize immediately from propProfile or cookie cache to prevent showing default AnimeMaster
  const [profile, setProfile] = useState<StoredUserProfile | null>(() => {
    return propProfile || getCachedUserProfile();
  });
  
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(() => {
    return !propProfile && !getCachedUserProfile();
  });

  const [avatarImageLoaded, setAvatarImageLoaded] = useState(false);

  // Settings temp states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempStyle, setTempStyle] = useState('adventurer');
  const [tempSeed, setTempSeed] = useState('');

  useEffect(() => {
    setHistoryList(getWatchHistory());
    
    // If we have a prop profile, use it and update cache
    if (propProfile) {
      setProfile(propProfile);
      saveCachedUserProfile(propProfile);
      setIsLoadingProfile(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Hydrate profile data from Firebase
        try {
          const data = await fetchUserDataFromFirebase();
          if (data?.profile && data.profile.username) {
            const fetchedProfile: StoredUserProfile = {
              username: data.profile.username,
              avatarStyle: data.profile.avatarStyle || 'adventurer',
              avatarSeed: data.profile.avatarSeed || data.profile.username,
            };
            setProfile(fetchedProfile);
            saveCachedUserProfile(fetchedProfile);
            if (onUpdateProfile) onUpdateProfile(fetchedProfile);
          } else {
            // If user has local cached profile, sync to cloud
            const cached = getCachedUserProfile();
            if (cached) {
              syncProfileToFirebase(cached);
            }
          }
        } catch (e) {
          console.warn('Could not fetch cloud profile:', e);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        setIsLoadingProfile(false);
      }
    });

    return () => unsubscribe();
  }, [propProfile]);

  const handleOpenSettings = () => {
    const currentName = profile?.username || '';
    const currentStyle = profile?.avatarStyle || 'adventurer';
    const currentSeed = profile?.avatarSeed || currentName || 'anime-hero';
    setTempUsername(currentName);
    setTempStyle(currentStyle);
    setTempSeed(currentSeed);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    const finalName = tempUsername.trim() || 'User';
    const finalSeed = tempSeed.trim() || finalName;
    const newProfile: StoredUserProfile = {
      username: finalName,
      avatarStyle: tempStyle,
      avatarSeed: finalSeed,
    };
    
    setProfile(newProfile);
    saveCachedUserProfile(newProfile);
    if (onUpdateProfile) onUpdateProfile(newProfile);
    setIsSettingsOpen(false);
    
    // Sync to cloud if logged in
    if (currentUser) {
      await syncProfileToFirebase(newProfile);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      window.location.reload();
    } catch (error) {
      console.error('Failed to sign in', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      saveCachedUserProfile(null);
      setProfile(null);
      window.location.reload();
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  };

  const avatarUrl = profile
    ? `https://api.dicebear.com/7.x/${profile.avatarStyle || 'adventurer'}/svg?seed=${encodeURIComponent(profile.avatarSeed || profile.username)}`
    : null;

  return (
    <div className="w-full h-full bg-zinc-950 text-zinc-200 flex flex-col overflow-y-auto pb-20 select-none">
      {/* Profile Header */}
      <div className="p-6 flex flex-col items-center bg-zinc-900 border-b border-zinc-800">
        {/* Avatar Container with Skeleton Loader */}
        <div className="relative group mb-3">
          {isLoadingProfile || !profile ? (
            <div className="w-20 h-20 rounded-full bg-zinc-800 animate-pulse border-2 border-zinc-700 shadow-xl flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-zinc-700/50 animate-pulse" />
            </div>
          ) : (
            <div className="relative w-20 h-20">
              {!avatarImageLoaded && (
                <div className="absolute inset-0 rounded-full bg-zinc-800 animate-pulse border-2 border-pink-500/50" />
              )}
              <img
                src={avatarUrl || ''}
                alt={profile.username}
                onLoad={() => setAvatarImageLoaded(true)}
                className={`w-20 h-20 rounded-full object-cover bg-zinc-950 ring-2 ring-pink-500 shadow-xl transition-opacity duration-200 ${
                  avatarImageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900 shadow-sm" />
            </div>
          )}
        </div>

        {/* Username with Skeleton Loader */}
        {isLoadingProfile || !profile ? (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <div className="w-32 h-5 bg-zinc-800 rounded-md animate-pulse" />
            <div className="w-48 h-3 bg-zinc-800/60 rounded-md animate-pulse mt-1" />
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
              @{profile.username}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Anime shorts & continuous streams</p>
          </>
        )}

        {/* User Stats: followers based on history list length, likes based on liked list length */}
        <div className="flex gap-12 my-4 text-center justify-center">
          <div>
            <div className="text-sm font-bold text-zinc-100">{historyList.length}</div>
            <div className="text-[10px] text-zinc-400 font-medium">Followers</div>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100">{likedAnimeList.length}</div>
            <div className="text-[10px] text-zinc-400 font-medium">Likes</div>
          </div>
        </div>

        {/* Profile Action buttons */}
        <div className="flex gap-2.5 w-full max-w-xs">
          <button
            onClick={onBackToFeed}
            className="flex-1 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-sm active:scale-95 transition-transform"
          >
            Back to Feed
          </button>
          <button 
            onClick={handleOpenSettings}
            className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs: Liked Videos | History */}
      <div className="flex border-b border-zinc-800 text-xs font-semibold text-zinc-400">
        <button
          onClick={() => setActiveTab('liked')}
          className={`flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'liked' ? 'border-pink-500 text-pink-400 font-bold' : 'border-transparent hover:text-zinc-200'
          }`}
        >
          <Heart className="w-3.5 h-3.5 fill-current" /> Liked ({likedAnimeList.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'history' ? 'border-pink-500 text-pink-400 font-bold' : 'border-transparent hover:text-zinc-200'
          }`}
        >
          <span>⏱️ History ({historyList.length})</span>
        </button>
      </div>

      {/* Tab Grid */}
      <div className="p-3">
        {activeTab === 'liked' && (
          <div className="grid grid-cols-3 gap-2">
            {likedAnimeList.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-zinc-500 text-xs">
                No liked anime yet. Tap the heart on any video to like!
              </div>
            ) : (
              likedAnimeList.map((anime) => (
                <div
                  key={anime.id}
                  onClick={() => {
                    onSelectAnime(anime);
                    onBackToFeed();
                  }}
                  className="aspect-[3/4] relative rounded-xl overflow-hidden cursor-pointer group border border-zinc-800"
                >
                  <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white opacity-80" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="grid grid-cols-3 gap-2">
            {historyList.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-zinc-500 text-xs">
                No history items yet. Start watching some videos!
              </div>
            ) : (
              historyList.map((item, idx) => (
                <div
                  key={`${item.anime?.id || idx}-${item.episode}`}
                  onClick={() => {
                    if (item.anime) {
                      onSelectAnime(item.anime);
                      onBackToFeed();
                    }
                  }}
                  className="aspect-[3/4] relative rounded-xl overflow-hidden cursor-pointer group border border-zinc-800"
                >
                  <img src={item.anime?.poster} alt={item.anime?.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 flex flex-col justify-between p-1.5 text-left">
                    <span className="self-end px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-zinc-300">
                      Ep {item.episode}
                    </span>
                    <div className="flex items-center justify-center flex-1">
                      <Play className="w-6 h-6 text-white fill-white opacity-80" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-zinc-100 uppercase tracking-wider">Profile Settings</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Avatar Preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full bg-zinc-950 ring-2 ring-pink-500 overflow-hidden flex items-center justify-center">
                <img
                  src={`https://api.dicebear.com/7.x/${tempStyle}/svg?seed=${encodeURIComponent(tempSeed)}`}
                  alt="Avatar Preview"
                  className="w-22 h-22 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[10px] font-extrabold text-pink-500 uppercase tracking-widest">Avatar Preview</span>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Username</label>
                <input
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full bg-zinc-950 text-sm text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Avatar Seed</label>
                <input
                  type="text"
                  value={tempSeed}
                  onChange={(e) => setTempSeed(e.target.value)}
                  placeholder="Type avatar seed..."
                  className="w-full bg-zinc-950 text-sm text-zinc-100 px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Avatar Style</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'adventurer', label: 'Adventurer' },
                    { id: 'lorelei', label: 'Lorelei' },
                    { id: 'bottts', label: 'Bottts' },
                    { id: 'pixel-art', label: 'Pixel Art' },
                    { id: 'fun-emoji', label: 'Emoji' },
                    { id: 'avataaars', label: 'Avatar' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setTempStyle(style.id)}
                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                        tempStyle === style.id
                          ? 'bg-pink-500/20 border-pink-500 text-pink-400 font-extrabold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Auth Section */}
            <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-zinc-800">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Cloud Sync</span>
              {currentUser ? (
                <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <img src={currentUser.photoURL || ''} alt="User" className="w-6 h-6 rounded-full shrink-0" referrerPolicy="no-referrer" />
                    <span className="text-xs font-bold text-zinc-200 truncate">{currentUser.displayName || currentUser.email}</span>
                  </div>
                  <button onClick={handleSignOut} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white shrink-0">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                  Sign in to Sync Data
                </button>
              )}
            </div>

            {/* Save Button */}
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md active:scale-95 transition-transform"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
