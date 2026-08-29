const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "  useEffect(() => {\n    const fetchCommits",
  `  useEffect(() => {
    // Nuke service workers to fix cache issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
    const fetchCommits`
);

fs.writeFileSync('src/App.tsx', code);
