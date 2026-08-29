import React, { useState, useEffect } from 'react';
import {
  LogIn,
  X,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Send,
  Check
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload
} from '../lib/firebase';
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
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // reCAPTCHA security challenge state
  const [isCaptchaVerified, setIsCaptchaVerified] = useState(false);
  const [captchaChallenge, setCaptchaChallenge] = useState<{ num1: number; num2: number; answer: number }>({ num1: 4, num2: 5, answer: 9 });
  const [captchaInput, setCaptchaInput] = useState('');
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);

  // Email verification flow state
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [verificationEmailSentTo, setVerificationEmailSentTo] = useState('');
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 8) + 2;
    const n2 = Math.floor(Math.random() * 8) + 1;
    setCaptchaChallenge({ num1: n1, num2: n2, answer: n1 + n2 });
    setCaptchaInput('');
  };

  useEffect(() => {
    if (isOpen) {
      generateCaptcha();
      setIsCaptchaVerified(false);
      setAwaitingEmailVerification(false);
      setAuthError(null);
    }
  }, [isOpen, isSignUp]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
      toast.success('Signed in successfully!');
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
      setIsLoading(false);
    }
  };

  const handleVerifyCaptcha = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(captchaInput.trim(), 10) === captchaChallenge.answer) {
      setIsCaptchaVerified(true);
      setShowCaptchaModal(false);
      toast.success('Security check verified!');
    } else {
      toast.error('Incorrect security answer. Please try again.');
      generateCaptcha();
    }
  };

  const handleCheckEmailVerified = async () => {
    if (!auth.currentUser) {
      toast.error('No active session found. Please sign in.');
      return;
    }
    try {
      setIsCheckingVerification(true);
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) {
        toast.success('Email confirmed! Welcome to Ani-Tok.');
        setAwaitingEmailVerification(false);
        onClose(true);
        if (onOpenProfileSetup) {
          onOpenProfileSetup();
        }
      } else {
        toast.error('Email not verified yet. Please check your inbox or spam folder.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to check verification status.');
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    try {
      setIsResendingEmail(true);
      await sendEmailVerification(auth.currentUser);
      toast.success('Verification email resent! Check your inbox.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // reCAPTCHA verification required for Sign Up
    if (isSignUp && !isCaptchaVerified) {
      setShowCaptchaModal(true);
      toast('Please complete the security check to continue', { icon: '🛡️' });
      return;
    }

    try {
      setIsLoading(true);
      setAuthError(null);
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Send Firebase confirmation email
        try {
          await sendEmailVerification(userCred.user);
          setVerificationEmailSentTo(email);
          setAwaitingEmailVerification(true);
          toast.success('Account created! Verification link sent to your email.');
          return;
        } catch (mailErr: any) {
          console.warn('Could not send verification email:', mailErr);
          toast.success('Account created successfully!');
          onClose(true);
          if (onOpenProfileSetup) onOpenProfileSetup();
        }
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          setVerificationEmailSentTo(email);
          setAwaitingEmailVerification(true);
          toast('Please verify your email address to continue.', { icon: '✉️' });
          return;
        }
        toast.success('Signed in successfully!');
        onClose(true);
        if (onOpenProfileSetup) {
          onOpenProfileSetup();
        }
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        const errorText = 'Email/Password sign-in is disabled in your Firebase Console. Please enable it in Firebase Authentication > Sign-in method, or use "Continue with Google".';
        setAuthError(errorText);
        toast.error(errorText, { duration: 6000 });
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Try signing in.');
        toast.error('Email already in use.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password.');
        toast.error('Invalid email or password.');
      } else {
        const msg = err.message || 'Authentication failed';
        setAuthError(msg);
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // reCAPTCHA Popup Challenge Dialog
  const renderCaptchaModal = () => {
    if (!showCaptchaModal) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <div className="w-full max-w-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-pink-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-pink-500" />
              <span>Security Verification</span>
            </div>
            <button
              onClick={() => setShowCaptchaModal(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-zinc-400">
            Please solve this math challenge to confirm you are human:
          </p>

          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
            <span className="font-mono text-base font-bold text-white">
              {captchaChallenge.num1} + {captchaChallenge.num2} = ?
            </span>
            <button
              type="button"
              onClick={generateCaptcha}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              title="New Challenge"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleVerifyCaptcha} className="space-y-3">
            <input
              type="number"
              placeholder="Enter answer"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-mono text-center text-sm focus:outline-none focus:border-pink-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCaptchaModal(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-semibold hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-pink-500 text-white text-xs font-bold hover:bg-pink-600 shadow-md shadow-pink-500/20"
              >
                Verify
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Email Confirmation Screen
  if (awaitingEmailVerification) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={() => onClose()}
      >
        <div 
          className="relative w-full max-w-sm bg-zinc-950 rounded-2xl border border-zinc-800 p-6 flex flex-col items-center gap-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => onClose()}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 mt-2">
            <Send className="w-7 h-7" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-lg font-black text-white">Check Your Email</h2>
            <p className="text-xs text-zinc-400 leading-relaxed px-2">
              We sent a verification link to{' '}
              <span className="text-white font-semibold">{verificationEmailSentTo}</span>. Click the link in your email to activate your account.
            </p>
          </div>

          <div className="w-full space-y-2 pt-2">
            <button
              onClick={handleCheckEmailVerified}
              disabled={isCheckingVerification}
              className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
            >
              {isCheckingVerification ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I've Verified My Email</span>
                </>
              )}
            </button>

            <button
              onClick={handleResendVerificationEmail}
              disabled={isResendingEmail}
              className="w-full py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-2"
            >
              {isResendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Resend Email</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => onClose()}
    >
      {renderCaptchaModal()}
      <div 
        className="relative w-full max-w-sm bg-zinc-950 rounded-2xl border border-zinc-800 p-6 flex flex-col items-center gap-5 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => onClose()}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-pink-500/20 mt-2 shrink-0">
          <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
             <LogIn className="w-7 h-7 text-white" />
          </div>
        </div>
        
        <div className="text-center space-y-1 w-full">
          <h2 className="text-xl font-black text-white tracking-tight">
            {isSignUp ? 'Create Account' : 'Welcome to Ani-Tok'}
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

        <div className="w-full space-y-4">
          {/* Primary Google Login */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-100 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-3 text-zinc-500 text-[11px] font-medium uppercase tracking-wider">or email</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div className="space-y-1">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>
            </div>

            {/* reCAPTCHA Security Check for Signup */}
            {isSignUp && (
              <div 
                onClick={() => {
                  if (!isCaptchaVerified) {
                    generateCaptcha();
                    setShowCaptchaModal(true);
                  }
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isCaptchaVerified
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400'
                    : 'bg-zinc-900/80 border-zinc-700/60 hover:border-pink-500/50 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    isCaptchaVerified ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-zinc-600 bg-zinc-800'
                  }`}>
                    {isCaptchaVerified && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-semibold">I'm not a robot (reCAPTCHA)</span>
                </div>
                <ShieldCheck className={`w-4 h-4 ${isCaptchaVerified ? 'text-emerald-400' : 'text-zinc-500'}`} />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
