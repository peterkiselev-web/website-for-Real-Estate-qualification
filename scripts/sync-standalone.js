'use strict';

/**
 * Copies the qualification engine next to the client page so public/ works as a
 * flat static folder (and so the single file can be published anywhere).
 * lib/qualify.js stays the only source of truth; this copy is generated.
 */

const fs = require('fs');
const path = require('path');

for (const name of ['qualify.js', 'communities.js', 'funnel.js']) {
  const src = path.join(__dirname, '..', 'lib', name);
  const dest = path.join(__dirname, '..', 'public', name);
  const banner = `/* GENERATED FILE. Edit lib/${name} and run \`npm run sync\`. */\n`;
  fs.writeFileSync(dest, banner + fs.readFileSync(src, 'utf8'), 'utf8');
  console.log(`Wrote public/${name} from lib/${name}`);
}
