// GitHub Pages has no SPA rewrite rule. Serving index.html as 404.html lets a
// deep link like /mood-gallery/painting boot the app, which then redirects home.
import { copyFileSync } from 'node:fs'
copyFileSync('dist/index.html', 'dist/404.html')
console.log('postbuild: wrote dist/404.html')
