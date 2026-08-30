import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DraftingCompass,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  auth,
  googleProvider,
  githubProvider,
  signInWithPopup
} from '../lib/firebase';
import { setIsAuthenticatedCached, saveCachedAuthUser } from '../lib/cookies';
import toast from 'react-hot-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: (verifiedUser?: boolean) => void;
  onOpenProfileSetup?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onOpenProfileSetup,
}) => {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoadingProvider('google');
      setAuthError(null);
      const res = await signInWithPopup(auth, googleProvider);
      if (res?.user) {
        setIsAuthenticatedCached(true);
        saveCachedAuthUser({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
        });
      }
      toast.success('Signed in with Google!');
      onClose(true);
      if (onOpenProfileSetup) {
        onOpenProfileSetup();
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      const msg = err.message || 'Failed to sign in with Google';
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGithubSignIn = async () => {
    try {
      setLoadingProvider('github');
      setAuthError(null);
      const res = await signInWithPopup(auth, githubProvider);
      if (res?.user) {
        setIsAuthenticatedCached(true);
        saveCachedAuthUser({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
        });
      }
      toast.success('Signed in with GitHub!');
      onClose(true);
      if (onOpenProfileSetup) {
        onOpenProfileSetup();
      }
    } catch (err: any) {
      console.error('GitHub Sign In Error:', err);
      let msg = err.message || 'Failed to sign in with GitHub';
      if (err.code === 'auth/account-exists-with-different-credential') {
        msg = 'An account already exists with the same email address using a different sign-in method.';
      } else if (err.code === 'auth/auth-domain-config-required' || err.code === 'auth/operation-not-allowed') {
        msg = 'GitHub Sign-In is not enabled in Firebase Console. Please enable GitHub provider under Authentication > Sign-in method.';
      }
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="auth-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => onClose()}
        >
          <motion.div 
            key="auth-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-sm bg-zinc-950 rounded-2xl border border-zinc-800 p-6 flex flex-col items-center gap-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-[2px] flex items-center justify-center shadow-xl shadow-pink-500/20 mt-2 shrink-0">
              <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
                <DraftingCompass className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="text-center space-y-1 w-full">
              <h2 className="text-xl font-black text-white tracking-tight">
                Welcome to Ani-Tok
              </h2>
              <p className="text-xs text-zinc-400 font-medium px-2">
                Sign in to sync your profile, likes, and watch history across all devices.
              </p>
            </div>

            {authError && (
              <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-amber-300 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="w-full space-y-3 pt-2">
              {/* Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loadingProvider !== null}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-100 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {loadingProvider === 'google' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Continue with GitHub */}
              <button
                type="button"
                onClick={handleGithubSignIn}
                disabled={loadingProvider !== null}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-sm active:scale-[0.99] transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {loadingProvider === 'github' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <>
                    <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span>Continue with GitHub</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
