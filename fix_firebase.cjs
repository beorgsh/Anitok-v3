const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseStore.ts', 'utf8');

code = code.replace(
  "import { AnimeItem, WatchHistoryItem } from '../types/anime';",
  "import { AnimeItem, WatchHistoryItem } from '../types/anime';\nimport toast from 'react-hot-toast';"
);

code = code.replace(
  /export const syncProfileToFirebase = async [\s\S]*?console\.warn\('Syncing profile to Firebase delayed \(client offline\)\.'\);\s*\n*\}/,
  `export const syncProfileToFirebase = async (data: Partial<UserProfileData>) => {
  const docRef = getUserDocRef();
  if (!docRef) throw new Error("Not logged in");
  try {
    await setDoc(docRef, { profile: data }, { merge: true });
    toast.success('Profile saved to database!');
  } catch (error: any) {
    console.error('Failed to sync profile:', error);
    toast.error(\`Database Error: \${error.message || 'Check Firestore Rules'}\`);
    throw error;
  }
}`
);

fs.writeFileSync('src/lib/firebaseStore.ts', code);
