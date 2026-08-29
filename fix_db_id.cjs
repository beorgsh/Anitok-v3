const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(
  "export const db = getFirestore(app);",
  "export const db = getFirestore(app, '(default)');"
);

fs.writeFileSync('src/lib/firebase.ts', code);
