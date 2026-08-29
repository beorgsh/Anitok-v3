import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB_SvhbE4BtNKzLD_umfd8GCeyOwwr5hig",
  authDomain: "anitok-v2.firebaseapp.com",
  databaseURL: "https://anitok-v2-default-rtdb.firebaseio.com",
  projectId: "anitok-v2",
  storageBucket: "anitok-v2.firebasestorage.app",
  messagingSenderId: "531091955472",
  appId: "1:531091955472:web:65e9e7b82e0c89fcee0f95",
  measurementId: "G-0NNFRX7DKL"
};

// Initialize Firebase app
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Explicitly ensure auth persistence in browser localStorage/IndexedDB
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Could not set browserLocalPersistence:', err);
  });
}

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

export {
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload,
  doc,
  setDoc,
  getDoc,
  onSnapshot
};
export type { User };

