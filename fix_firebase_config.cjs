const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

const newConfig = `{
  apiKey: "AIzaSyB_SvhbE4BtNKzLD_umfd8GCeyOwwr5hig",
  authDomain: "anitok-v2.firebaseapp.com",
  databaseURL: "https://anitok-v2-default-rtdb.firebaseio.com",
  projectId: "anitok-v2",
  storageBucket: "anitok-v2.firebasestorage.app",
  messagingSenderId: "531091955472",
  appId: "1:531091955472:web:65e9e7b82e0c89fcee0f95",
  measurementId: "G-0NNFRX7DKL"
}`;

code = code.replace(/const firebaseConfig = \{[\s\S]*?\};/, 'const firebaseConfig = ' + newConfig + ';');

fs.writeFileSync('src/lib/firebase.ts', code);
