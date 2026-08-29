import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AnimeItem, WatchHistoryItem } from '../types/anime';
import toast from 'react-hot-toast';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on boot
export async function testFirestoreConnection() {
  try {
    const testDoc = doc(db, '_connection_test', 'ping');
    await getDocFromServer(testDoc);
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection: client is offline or initializing.');
    }
  }
}
testFirestoreConnection();

// User Profile Data Structure
export interface UserProfileData {
  username: string;
  avatarStyle: string;
  avatarSeed: string;
}

// Global user state document reference
const getUserDocRef = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return doc(db, 'users', uid);
};

export const syncProfileToFirebase = async (data: Partial<UserProfileData>) => {
  const docRef = getUserDocRef();
  if (!docRef) throw new Error("Not logged in");
  try {
    await setDoc(docRef, { profile: data }, { merge: true });
    toast.success('Profile saved to database!');
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
    toast.error(`Database Error: ${error.message || 'Check Firestore permissions'}`);
    throw error;
  }
};

export const syncHistoryToFirebase = async (history: WatchHistoryItem[]) => {
  const docRef = getUserDocRef();
  if (!docRef) return;
  try {
    // Keep only the most recent 100 items to avoid document size limits
    const trimmed = history.slice(0, 100);
    await setDoc(docRef, { history: trimmed }, { merge: true });
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
  }
};

export const syncLikesToFirebase = async (likes: AnimeItem[]) => {
  const docRef = getUserDocRef();
  if (!docRef) return;
  try {
    await setDoc(docRef, { likes }, { merge: true });
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser?.uid}`);
  }
};

export const fetchUserDataFromFirebase = async () => {
  const docRef = getUserDocRef();
  if (!docRef) return null;
  
  try {
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data() as {
        profile?: UserProfileData;
        history?: WatchHistoryItem[];
        likes?: AnimeItem[];
      };
    }
  } catch (error: any) {
    handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
  }
  return null;
};
