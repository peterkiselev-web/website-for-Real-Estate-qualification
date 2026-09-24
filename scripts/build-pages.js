'use strict';

/**
 * Builds the static site.
 *
 * public/shortlist.html is written as a fragment, with no doctype and no head,
 * so it can be dropped into a host that supplies its own. A real web server
 * needs a complete document, and above all it needs the viewport meta tag, or
 * every phone renders the page at desktop width and the type comes out tiny.
 *
 * So this wraps the fragment once and writes it twice:
 *   public/index.html   what `npm start` serves at /
 *   docs/               what GitHub Pages serves, engines and images included
 *
 * Run it with `npm run pages` after changing the client page.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const docs = path.join(root, 'docs');

const ENGINES = ['qualify.js', 'communities.js', 'funnel.js'];
const BANNER = '<!-- GENERATED. Edit public/shortlist.html and run `npm run pages`. -->';

function wrap(fragment) {
  const title = (fragment.match(/<title>([^<]*)<\/title>/) || [, 'Which Dubai Area Suits You'])[1];
  const body = fragment.replace(/<title>[^<]*<\/title>\s*/, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f7f3ea">
<meta name="description" content="Swipe through Dubai property and find the communities that suit you.">
<title>${title}</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${BANNER}
</head>
<body>
${body}
</body>
</html>
`;
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function main() {
  const fragment = fs.readFileSync(path.join(pub, 'shortlist.html'), 'utf8');
  const page = wrap(fragment);

  fs.writeFileSync(path.join(pub, 'index.html'), page, 'utf8');

  fs.rmSync(docs, { recursive: true, force: true });
  fs.mkdirSync(path.join(docs, 'img'), { recursive: true });
  fs.writeFileSync(path.join(docs, 'index.html'), page, 'utf8');
  // Tells GitHub Pages to serve the files as they are, with no Jekyll processing.
  fs.writeFileSync(path.join(docs, '.nojekyll'), '', 'utf8');

  for (const name of ENGINES) copy(path.join(root, 'lib', name), path.join(docs, name));
  copy(path.join(pub, 'favicon.svg'), path.join(docs, 'favicon.svg'));

  const images = fs.readdirSync(path.join(pub, 'img')).filter((f) => f.endsWith('.svg'));
  for (const name of images) copy(path.join(pub, 'img', name), path.join(docs, 'img', name));

  console.log(`Wrote public/index.html and docs/ (${images.length} images, ${ENGINES.length} engine files)`);
}

if (require.main === module) main();

module.exports = { wrap };
