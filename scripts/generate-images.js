'use strict';

/**
 * Draws the bundled card illustrations into public/img as flat SVGs.
 *
 * The output is committed, so you only need to run this (`npm run images`)
 * after editing a scene. Swapping in real photography does not require this
 * script at all: point the card's `image` field at a photo URL in lib/deck.js.
 */

const fs = require('fs');
const path = require('path');

const W = 800;
const H = 600;

const C = {
  ink: '#1d2733',
  line: '#2b3440',
  cream: '#fbf7f1',
  wall: '#f4ece1',
  brick: '#c4785a',
  brickDark: '#a85f45',
  roof: '#3d4a5c',
  roofWarm: '#7c4b3a',
  glass: '#a9cfe6',
  glassDark: '#7fb2d1',
  grass: '#69bd8b',
  grassDark: '#3f9c6b',
  leaf: '#2f7d54',
  leafMid: '#46a06c',
  leafLight: '#8ed3a4',
  trunk: '#8a6142',
  stone: '#e3dbd0',
  stoneDark: '#c9bfb2',
  water: '#3fb8da',
  waterDark: '#1f94c0',
  waterLight: '#9fe2f0',
  sand: '#f0e2cc',
  terracotta: '#d9734f',
  sun: '#ffd166',
  steel: '#8d9aa8',
  shadow: 'rgba(29,39,51,0.12)',
};

/* ------------------------------------------------------------------ utils */

function svg(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<defs>${defs}</defs>
${body}
</svg>
`;
}

function linear(id, from, to, vertical = true) {
  const coords = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0";';
  return `<linearGradient id="${id}" ${coords}><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
}

function sky(id = 'sky', from = '#cfe9ff', to = '#f2faff') {
  return { def: linear(id, from, to), body: `<rect width="${W}" height="${H}" fill="url(#${id})"/>` };
}

function sun(x, y, r = 46, color = C.sun) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.85"/>`;
}

function cloud(x, y, s = 1, opacity = 0.75) {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="#ffffff" opacity="${opacity}">
    <ellipse cx="0" cy="0" rx="46" ry="26"/><ellipse cx="38" cy="8" rx="34" ry="20"/><ellipse cx="-36" cy="10" rx="30" ry="18"/>
  </g>`;
}

function ground(y, fill = C.grass) {
  return `<rect x="0" y="${y}" width="${W}" height="${H - y}" fill="${fill}"/>`;
}

/** A round headed tree: trunk plus three overlapping canopies. */
function tree(x, baseY, h, leaf = C.leaf, mid = C.leafMid) {
  const trunkW = Math.max(8, h * 0.09);
  const canopyR = h * 0.34;
  const canopyY = baseY - h * 0.72;
  return `<g>
    <rect x="${x - trunkW / 2}" y="${baseY - h * 0.6}" width="${trunkW}" height="${h * 0.6}" rx="${trunkW / 2}" fill="${C.trunk}"/>
    <circle cx="${x - canopyR * 0.6}" cy="${canopyY + canopyR * 0.35}" r="${canopyR * 0.85}" fill="${leaf}"/>
    <circle cx="${x + canopyR * 0.62}" cy="${canopyY + canopyR * 0.45}" r="${canopyR * 0.78}" fill="${leaf}"/>
    <circle cx="${x}" cy="${canopyY - canopyR * 0.1}" r="${canopyR}" fill="${mid}"/>
  </g>`;
}

/** Tall thin tree, good for framing city scenes. */
function poplar(x, baseY, h, leaf = C.leaf) {
  return `<g>
    <rect x="${x - 5}" y="${baseY - h * 0.35}" width="10" height="${h * 0.35}" rx="5" fill="${C.trunk}"/>
    <ellipse cx="${x}" cy="${baseY - h * 0.62}" rx="${h * 0.17}" ry="${h * 0.42}" fill="${leaf}"/>
  </g>`;
}

function bush(x, y, r, fill = C.leafMid) {
  return `<g fill="${fill}"><circle cx="${x - r * 0.6}" cy="${y}" r="${r * 0.7}"/><circle cx="${x + r * 0.6}" cy="${y}" r="${r * 0.65}"/><circle cx="${x}" cy="${y - r * 0.3}" r="${r}"/></g>`;
}

/** Loose planting: dots and stems, reads as a wild border. */
function flowers(x, y, count, spread, colors) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const fx = x + (i / Math.max(1, count - 1) - 0.5) * spread;
    const fy = y - ((i * 37) % 26);
    const col = colors[i % colors.length];
    out += `<line x1="${fx}" y1="${fy}" x2="${fx}" y2="${fy - 34}" stroke="${C.leaf}" stroke-width="4" stroke-linecap="round"/>`;
    out += `<circle cx="${fx}" cy="${fy - 38}" r="7" fill="${col}"/>`;
  }
  return `<g>${out}</g>`;
}

function potted(x, baseY, s = 1) {
  return `<g transform="translate(${x} ${baseY}) scale(${s})">
    <path d="M-26 0 L26 0 L20 44 L-20 44 Z" fill="${C.terracotta}"/>
    <rect x="-30" y="-8" width="60" height="12" rx="4" fill="#e88a66"/>
    ${bush(0, -26, 30, C.leafMid)}
    <circle cx="-22" cy="-44" r="14" fill="${C.leafLight}"/>
    <circle cx="20" cy="-48" r="12" fill="${C.leaf}"/>
  </g>`;
}

function waterBody(x, y, w, h, rx = 18, id = 'water') {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${id})"/>
    <path d="M${x + w * 0.12} ${y + h * 0.35} q 22 -12 44 0 t 44 0" fill="none" stroke="${C.waterLight}" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
    <path d="M${x + w * 0.3} ${y + h * 0.68} q 22 -12 44 0 t 44 0" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
  </g>`;
}

function lounger(x, y, s = 1, flip = false) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path d="M0 0 L70 0 L70 -8 L0 -8 Z" fill="#ffffff"/>
    <path d="M0 -8 L-4 -34 L18 -34 L14 -8 Z" fill="#ffffff"/>
    <rect x="4" y="0" width="6" height="14" fill="${C.stoneDark}"/>
    <rect x="58" y="0" width="6" height="14" fill="${C.stoneDark}"/>
  </g>`;
}

function parasol(x, y, s = 1, color = C.terracotta) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-3" y="-70" width="6" height="70" fill="${C.stoneDark}"/>
    <path d="M-56 -70 Q0 -110 56 -70 Z" fill="${color}"/>
    <path d="M-18 -70 Q0 -94 18 -70 Z" fill="#ffffff" opacity="0.65"/>
  </g>`;
}

function windowGrid(x, y, w, h, cols, rows, fill = C.glass, gap = 8) {
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - gap * (rows + 1)) / rows;
  let out = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = (r * cols + c) % 5 === 0;
      out += `<rect x="${x + gap + c * (cw + gap)}" y="${y + gap + r * (ch + gap)}" width="${cw}" height="${ch}" rx="3" fill="${lit ? '#cbe6f5' : fill}"/>`;
    }
  }
  return `<g>${out}</g>`;
}

/* -------------------------------------------------------------- floorplan */

function planFrame(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" stroke="${C.line}" stroke-width="12"/>`;
}

function wall(x1, y1, x2, y2, width = 12) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.line}" stroke-width="${width}" stroke-linecap="square"/>`;
}

function planLabel(x, y, text, size = 19) {
  return `<text x="${x}" y="${y}" font-family="Verdana, Geneva, sans-serif" font-size="${size}" letter-spacing="2" fill="#7a8592" text-anchor="middle">${text}</text>`;
}

function furn(x, y, w, h, rx = 4, fill = '#dfe6ee') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#9aa7b4" stroke-width="3"/>`;
}

function sofa(x, y, w = 110, h = 46) {
  return `<g>${furn(x, y, w, h, 8)}${furn(x, y - 12, w, 16, 6, '#cfd9e4')}</g>`;
}

function bed(x, y, w = 96, h = 120) {
  return `<g>${furn(x, y, w, h, 8)}${furn(x + 8, y + 8, w - 16, 30, 6, '#cfd9e4')}</g>`;
}

function diningSet(cx, cy, r = 34) {
  let chairs = '';
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    chairs += `<circle cx="${(cx + Math.cos(a) * (r + 24)).toFixed(1)}" cy="${(cy + Math.sin(a) * (r + 24)).toFixed(1)}" r="12" fill="#dfe6ee" stroke="#9aa7b4" stroke-width="3"/>`;
  }
  return `<g>${chairs}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e9eff5" stroke="#9aa7b4" stroke-width="3"/></g>`;
}

function kitchenRun(x, y, w, h, withIsland) {
  let out = furn(x, y, w, h, 4, '#e9eff5');
  for (let i = 1; i < 4; i += 1) {
    out += `<line x1="${x + (w / 4) * i}" y1="${y}" x2="${x + (w / 4) * i}" y2="${y + h}" stroke="#9aa7b4" stroke-width="3"/>`;
  }
  if (withIsland) out += furn(x + w * 0.15, y + h + 44, w * 0.7, 40, 8, '#dfe6ee');
  return `<g>${out}</g>`;
}

function doorSwing(x, y, r, rotate = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate})">
    <path d="M0 0 L${r} 0 A${r} ${r} 0 0 1 0 ${r}" fill="none" stroke="#9aa7b4" stroke-width="3"/>
    <rect x="-2" y="0" width="4" height="${r}" fill="#9aa7b4"/>
  </g>`;
}

function planBase(inner) {
  const defs = linear('planbg', '#fdfaf5', '#f1ece3');
  const body = `<rect width="${W}" height="${H}" fill="url(#planbg)"/>
  <g opacity="0.5">${gridLines()}</g>
  ${inner}`;
  return svg(defs, body);
}

function gridLines() {
  let out = '';
  for (let x = 40; x < W; x += 40) out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#e5ded2" stroke-width="1"/>`;
  for (let y = 40; y < H; y += 40) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e5ded2" stroke-width="1"/>`;
  return out;
}

/* ----------------------------------------------------------- house shapes */

function pitchedHouse(x, baseY, w, h, opts = {}) {
  const roofH = opts.roofH || h * 0.5;
  const wallFill = opts.wall || C.wall;
  const roofFill = opts.roof || C.roofWarm;
  const doorFill = opts.door || C.terracotta;
  return `<g>
    <rect x="${x}" y="${baseY - h}" width="${w}" height="${h}" fill="${wallFill}"/>
    <path d="M${x - 16} ${baseY - h} L${x + w / 2} ${baseY - h - roofH} L${x + w + 16} ${baseY - h} Z" fill="${roofFill}"/>
    <rect x="${x + w * 0.42}" y="${baseY - h * 0.55}" width="${w * 0.18}" height="${h * 0.55}" rx="4" fill="${doorFill}"/>
    <rect x="${x + w * 0.1}" y="${baseY - h * 0.8}" width="${w * 0.22}" height="${h * 0.3}" rx="3" fill="${C.glass}" stroke="#ffffff" stroke-width="4"/>
    <rect x="${x + w * 0.68}" y="${baseY - h * 0.8}" width="${w * 0.22}" height="${h * 0.3}" rx="3" fill="${C.glass}" stroke="#ffffff" stroke-width="4"/>
  </g>`;
}

/* ------------------------------------------------------------- the scenes */

const scenes = {};

/* --- style ---------------------------------------------------------- */

scenes['style-modern'] = () => {
  const s = sky('sky', '#c9e6ff', '#f4fbff');
  return svg(
    `${s.def}${linear('glass', '#bfe0f2', '#7fb2d1')}${linear('sand', '#f6efe4', '#e6dbcb')}`,
    `${s.body}${sun(662, 118, 52)}${cloud(150, 118, 1.05, 0.8)}
    ${ground(452, '#7ec89a')}
    <rect x="0" y="452" width="${W}" height="26" fill="#6cb98b"/>
    <g>
      <rect x="120" y="212" width="360" height="248" fill="#ffffff"/>
      <rect x="150" y="242" width="300" height="130" rx="6" fill="url(#glass)"/>
      <line x1="300" y1="242" x2="300" y2="372" stroke="#ffffff" stroke-width="8"/>
      <rect x="150" y="394" width="130" height="66" rx="4" fill="url(#glass)"/>
      <rect x="320" y="394" width="130" height="66" rx="4" fill="#eef2f5"/>
      <rect x="104" y="196" width="392" height="20" rx="6" fill="#e8edf1"/>
    </g>
    <g>
      <rect x="480" y="278" width="230" height="182" fill="#f0f3f6"/>
      <rect x="504" y="304" width="182" height="96" rx="6" fill="url(#glass)"/>
      <rect x="504" y="416" width="182" height="20" rx="6" fill="#dfe6ec"/>
      <rect x="466" y="262" width="258" height="20" rx="6" fill="#e8edf1"/>
    </g>
    <rect x="120" y="460" width="590" height="14" fill="#e8e2d6"/>
    ${tree(80, 470, 150)}${bush(640, 470, 34)}${bush(700, 474, 26, C.leafLight)}
    ${poplar(750, 474, 170)}
    <ellipse cx="300" cy="486" rx="200" ry="14" fill="${C.shadow}"/>`
  );
};

scenes['style-period'] = () => {
  const s = sky('sky', '#d7e9ff', '#fbf3ea');
  const brickRows = (() => {
    let out = '';
    for (let y = 200; y < 470; y += 22) {
      out += `<line x1="200" y1="${y}" x2="600" y2="${y}" stroke="#b46b50" stroke-width="2" opacity="0.5"/>`;
    }
    return out;
  })();
  return svg(
    `${s.def}${linear('sashglass', '#cfe6f3', '#9dc4dd')}`,
    `${s.body}${cloud(600, 110, 1, 0.7)}
    ${ground(470, '#78c093')}
    <g>
      <rect x="200" y="196" width="400" height="278" fill="${C.brick}"/>
      ${brickRows}
      <path d="M186 200 L400 122 L614 200 Z" fill="${C.roof}"/>
      <rect x="352" y="118" width="34" height="56" fill="${C.brickDark}"/>
      <rect x="344" y="108" width="50" height="16" rx="4" fill="#8c5240"/>
      <rect x="196" y="188" width="408" height="18" rx="4" fill="#f4ece1"/>
      ${[240, 336, 432, 528].map((x) => `<g><rect x="${x}" y="230" width="60" height="96" rx="4" fill="url(#sashglass)" stroke="#ffffff" stroke-width="6"/><line x1="${x}" y1="278" x2="${x + 60}" y2="278" stroke="#ffffff" stroke-width="6"/></g>`).join('')}
      ${[240, 528].map((x) => `<g><rect x="${x}" y="356" width="60" height="96" rx="4" fill="url(#sashglass)" stroke="#ffffff" stroke-width="6"/><line x1="${x}" y1="404" x2="${x + 60}" y2="404" stroke="#ffffff" stroke-width="6"/></g>`).join('')}
      <rect x="360" y="352" width="80" height="122" rx="6" fill="#2f5d4a"/>
      <circle cx="424" cy="418" r="6" fill="${C.sun}"/>
      <path d="M352 352 L448 352 L448 340 L352 340 Z" fill="#f4ece1"/>
      <path d="M360 340 a40 26 0 0 1 80 0 Z" fill="#f4ece1"/>
    </g>
    <rect x="330" y="474" width="140" height="10" fill="${C.stone}"/>
    ${bush(300, 478, 30)}${bush(520, 480, 26, C.leafLight)}${tree(120, 486, 190)}${tree(690, 490, 160, C.leafMid, C.leaf)}
    ${flowers(300, 476, 5, 90, ['#f2a2c0', '#ffd166', '#ffffff'])}`
  );
};

scenes['style-warehouse'] = () => {
  const s = sky('sky', '#dbe7f0', '#f7f2ec');
  let panes = '';
  for (let i = 0; i < 4; i += 1) {
    const x = 170 + i * 120;
    panes += `<rect x="${x}" y="238" width="94" height="180" rx="4" fill="url(#steelglass)" stroke="#3e4954" stroke-width="6"/>`;
    for (let r = 1; r < 4; r += 1) panes += `<line x1="${x}" y1="${238 + r * 45}" x2="${x + 94}" y2="${238 + r * 45}" stroke="#3e4954" stroke-width="4"/>`;
    panes += `<line x1="${x + 47}" y1="238" x2="${x + 47}" y2="418" stroke="#3e4954" stroke-width="4"/>`;
  }
  let bricks = '';
  for (let y = 210; y < 470; y += 20) bricks += `<line x1="140" y1="${y}" x2="660" y2="${y}" stroke="#a9604a" stroke-width="2" opacity="0.45"/>`;
  return svg(
    `${s.def}${linear('steelglass', '#cbdde8', '#8fb0c4')}`,
    `${s.body}${cloud(180, 106, 0.9, 0.6)}
    <rect x="0" y="470" width="${W}" height="130" fill="#b9b2a8"/>
    <rect x="0" y="470" width="${W}" height="8" fill="#a49d93"/>
    <g>
      <rect x="140" y="206" width="520" height="264" fill="#b8654c"/>
      ${bricks}
      <path d="M140 206 L260 150 L380 206 L500 150 L620 206 L660 206 L660 190 L140 190 Z" fill="#8f4f3c"/>
      <rect x="132" y="190" width="536" height="18" rx="4" fill="#7d4433"/>
      ${panes}
      <rect x="298" y="418" width="180" height="52" fill="#3e4954"/>
      <rect x="298" y="410" width="180" height="12" rx="4" fill="#556270"/>
    </g>
    ${potted(120, 500, 0.8)}${potted(690, 506, 0.9)}
    <rect x="240" y="470" width="300" height="10" fill="#9c958b"/>
    <ellipse cx="400" cy="500" rx="230" ry="12" fill="${C.shadow}"/>`
  );
};

scenes['style-cottage'] = () => {
  const s = sky('sky', '#cfe8ff', '#fdf6ea');
  let hills = `<path d="M0 420 q 160 -80 330 -20 t 470 -10 L800 600 L0 600 Z" fill="#8ecfa3"/>`;
  hills += `<path d="M0 470 q 220 -60 420 0 t 380 -20 L800 600 L0 600 Z" fill="#6ebd8c"/>`;
  return svg(
    `${s.def}`,
    `${s.body}${sun(120, 110, 44)}${cloud(560, 108, 1.1, 0.8)}${cloud(300, 150, 0.7, 0.5)}
    ${hills}
    ${tree(96, 470, 170, '#2f7d54', '#3f9c6b')}${tree(716, 486, 150)}
    <g>
      <rect x="264" y="304" width="286" height="178" fill="#fbf6ee"/>
      <path d="M240 308 L407 196 L574 308 Z" fill="#8b5a44"/>
      <path d="M240 308 L407 196 L574 308 Z" fill="none" stroke="#734635" stroke-width="6"/>
      <rect x="470" y="212" width="30" height="62" fill="#a06a52"/>
      <rect x="462" y="202" width="46" height="16" rx="4" fill="#8b5a44"/>
      <rect x="380" y="382" width="66" height="100" rx="4" fill="#3c6e55"/>
      <circle cx="432" cy="434" r="5" fill="${C.sun}"/>
      ${[292, 480].map((x) => `<g><rect x="${x}" y="344" width="64" height="62" rx="4" fill="${C.glass}" stroke="#ffffff" stroke-width="6"/><line x1="${x + 32}" y1="344" x2="${x + 32}" y2="406" stroke="#ffffff" stroke-width="5"/><line x1="${x}" y1="375" x2="${x + 64}" y2="375" stroke="#ffffff" stroke-width="5"/></g>`).join('')}
      <path d="M356 382 q56 -26 112 0 L468 372 q-56 -26 -112 0 Z" fill="#fbf6ee"/>
    </g>
    ${bush(268, 486, 30)}${bush(560, 488, 34, C.leafLight)}${bush(600, 492, 24)}
    ${flowers(250, 492, 4, 70, ['#f2a2c0', '#ffd166'])}
    ${flowers(580, 498, 4, 80, ['#ffffff', '#c9a7f5'])}
    <path d="M370 482 q 20 60 -40 118 L470 600 q 20 -60 -10 -118 Z" fill="#e6dccb"/>`
  );
};

scenes['style-tower'] = () => {
  const s = sky('sky', '#2f4a72', '#f8b98c');
  return svg(
    `${s.def}${linear('towerglass', '#8fb9d9', '#4c7fa8')}${linear('tower2', '#6f97ba', '#3c6a90')}`,
    `${s.body}${sun(640, 200, 60, '#ffd6a0')}
    <g opacity="0.55" fill="#42618c">
      <rect x="20" y="360" width="90" height="240"/><rect x="130" y="410" width="70" height="190"/>
      <rect x="600" y="390" width="80" height="210"/><rect x="700" y="350" width="90" height="250"/>
    </g>
    <g>
      <rect x="252" y="120" width="200" height="480" fill="url(#towerglass)"/>
      ${windowGrid(252, 140, 200, 430, 4, 12, '#5d8cb3', 8)}
      <rect x="240" y="106" width="224" height="22" rx="6" fill="#d7e6f0"/>
      <rect x="330" y="70" width="10" height="40" fill="#d7e6f0"/>
    </g>
    <g>
      <rect x="464" y="230" width="140" height="370" fill="url(#tower2)"/>
      ${windowGrid(464, 246, 140, 340, 3, 9, '#4b779c', 8)}
      <rect x="454" y="218" width="160" height="18" rx="6" fill="#c6d9e6"/>
    </g>
    <g>
      <rect x="150" y="300" width="112" height="300" fill="#5b82a6"/>
      ${windowGrid(150, 316, 112, 270, 3, 8, '#4a6f92', 7)}
    </g>
    <rect x="0" y="560" width="${W}" height="40" fill="#233a56"/>
    <g fill="#ffd166" opacity="0.9">
      <circle cx="120" cy="578" r="4"/><circle cx="330" cy="578" r="4"/><circle cx="520" cy="578" r="4"/><circle cx="700" cy="578" r="4"/>
    </g>`
  );
};

/* --- greenery -------------------------------------------------------- */

scenes['green-lawn'] = () => {
  const s = sky('sky', '#cfe9ff', '#f4fbff');
  let stripes = '';
  for (let i = 0; i < 8; i += 1) {
    stripes += `<path d="M${-100 + i * 130} 600 L${60 + i * 96} 366 L${150 + i * 96} 366 L${30 + i * 130} 600 Z" fill="${i % 2 ? '#63b986' : '#79c999'}"/>`;
  }
  return svg(
    `${s.def}`,
    `${s.body}${sun(690, 110, 46)}${cloud(180, 120, 1, 0.7)}
    <rect x="0" y="366" width="${W}" height="234" fill="#6fc08a"/>
    ${stripes}
    <g>
      <rect x="0" y="300" width="${W}" height="66" fill="#3f8a5f"/>
      <path d="M0 300 q 40 -26 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0" fill="#3f8a5f"/>
    </g>
    ${pitchedHouse(300, 306, 210, 96, { roof: '#5c6f85', wall: '#fbf7f1' })}
    ${tree(110, 340, 150)}${tree(660, 346, 170, '#2f7d54', '#4aa473')}
    <g>
      <rect x="520" y="404" width="140" height="10" rx="5" fill="#e4dccf"/>
      <rect x="536" y="414" width="12" height="30" fill="#c8bfae"/>
      <rect x="632" y="414" width="12" height="30" fill="#c8bfae"/>
      <rect x="520" y="384" width="140" height="12" rx="6" fill="#efe7da"/>
    </g>
    ${bush(180, 372, 28)}${bush(232, 376, 22, C.leafLight)}
    <ellipse cx="400" cy="420" rx="120" ry="12" fill="${C.shadow}"/>`
  );
};

scenes['green-wild'] = () => {
  const s = sky('sky', '#d8ecff', '#fdf7ec');
  let grassBlades = '';
  for (let i = 0; i < 40; i += 1) {
    const x = 10 + i * 20;
    const h = 40 + ((i * 53) % 60);
    grassBlades += `<path d="M${x} 600 q 6 ${-h / 2} 0 ${-h}" stroke="${i % 3 ? '#4aa473' : '#3f8a5f'}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  return svg(
    `${s.def}`,
    `${s.body}${sun(150, 116, 42)}${cloud(590, 128, 0.9, 0.6)}
    <rect x="0" y="330" width="${W}" height="270" fill="#7cc494"/>
    <path d="M0 330 q 120 -40 240 -6 t 240 -14 t 320 10 L800 600 L0 600 Z" fill="#6bb888"/>
    <g opacity="0.9">
      <rect x="0" y="250" width="${W}" height="84" fill="#9c7a5c"/>
      ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 52}" y="244" width="40" height="92" rx="6" fill="${i % 2 ? '#ad886a' : '#a07d5f'}"/>`).join('')}
    </g>
    ${tree(80, 330, 190, '#2f7d54', '#44a06d')}${tree(720, 340, 170)}
    <path d="M300 600 q 60 -120 40 -240 q 40 110 120 240 Z" fill="#5faa7d" opacity="0.35"/>
    ${flowers(160, 430, 7, 220, ['#f2a2c0', '#ffd166', '#c9a7f5', '#ffffff'])}
    ${flowers(470, 420, 8, 260, ['#ffffff', '#f2a2c0', '#8ed3a4', '#ff9f7a'])}
    ${flowers(620, 470, 6, 200, ['#ffd166', '#c9a7f5'])}
    ${bush(250, 470, 42, '#4aa473')}${bush(560, 486, 50, '#3f8a5f')}${bush(400, 500, 38, '#62b487')}
    ${grassBlades}
    <g transform="translate(360 392)"><circle cx="0" cy="0" r="9" fill="#ffd166"/><path d="M-22 -12 q 22 -18 44 0 q -22 12 -44 0" fill="#ffffff" opacity="0.85"/></g>`
  );
};

scenes['green-balcony'] = () => {
  const s = sky('sky', '#bfe0f7', '#f6fbff');
  return svg(
    `${s.def}${linear('rail', '#b9c6d2', '#8d9aa8')}`,
    `${s.body}${cloud(620, 120, 1, 0.7)}${cloud(180, 190, 0.6, 0.45)}
    <g opacity="0.45" fill="#7d9bb8">
      <rect x="40" y="250" width="120" height="350"/><rect x="640" y="220" width="130" height="380"/>
    </g>
    <rect x="0" y="470" width="${W}" height="130" fill="#e7ded1"/>
    <rect x="0" y="462" width="${W}" height="14" fill="#d5cabb"/>
    <g>
      <rect x="120" y="150" width="560" height="316" fill="#f7f2ea"/>
      <rect x="160" y="182" width="230" height="246" rx="6" fill="#cfe6f3" stroke="#ffffff" stroke-width="10"/>
      <line x1="275" y1="182" x2="275" y2="428" stroke="#ffffff" stroke-width="10"/>
      <rect x="430" y="182" width="210" height="246" rx="6" fill="#dfeaf2" stroke="#ffffff" stroke-width="10"/>
    </g>
    <g>
      <rect x="96" y="462" width="608" height="18" rx="6" fill="#ded4c5"/>
      <rect x="96" y="356" width="608" height="12" rx="6" fill="url(#rail)"/>
      ${Array.from({ length: 22 }, (_, i) => `<rect x="${110 + i * 27}" y="356" width="6" height="110" rx="3" fill="url(#rail)"/>`).join('')}
    </g>
    ${potted(180, 462, 0.95)}${potted(268, 462, 0.7)}${potted(620, 462, 1.05)}
    <g transform="translate(520 462)">
      <path d="M-22 0 L22 0 L18 38 L-18 38 Z" fill="#e0d4c2"/>
      ${bush(0, -20, 26, '#4aa473')}
      <path d="M-14 -34 q -22 -40 -6 -70" stroke="#3f8a5f" stroke-width="5" fill="none"/>
      <circle cx="-22" cy="-104" r="9" fill="#8ed3a4"/>
    </g>
    <g>
      <rect x="356" y="404" width="72" height="8" rx="4" fill="#c8b79e"/>
      <rect x="360" y="412" width="8" height="50" fill="#c8b79e"/><rect x="416" y="412" width="8" height="50" fill="#c8b79e"/>
      <rect x="330" y="380" width="30" height="34" rx="6" fill="#e9dfcd"/><rect x="424" y="380" width="30" height="34" rx="6" fill="#e9dfcd"/>
      <circle cx="392" cy="392" r="12" fill="${C.terracotta}"/>
    </g>
    <g stroke="#ffd166" stroke-width="4" opacity="0.9">
      <line x1="110" y1="330" x2="700" y2="316"/>
    </g>
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${140 + i * 68}" cy="${330 - i * 1.6}" r="7" fill="#ffe7a8"/>`).join('')}`
  );
};

scenes['green-roof'] = () => {
  const s = sky('sky', '#ffc98c', '#fde7cf');
  return svg(
    `${s.def}${linear('deck', '#d8bb94', '#bd9a70')}`,
    `${s.body}${sun(150, 130, 58, '#ffb27a')}
    <g opacity="0.35" fill="#9c6f8c">
      <rect x="0" y="300" width="90" height="120"/><rect x="110" y="260" width="70" height="160"/>
      <rect x="600" y="240" width="80" height="180"/><rect x="700" y="290" width="100" height="130"/>
      <rect x="380" y="320" width="60" height="100"/>
    </g>
    <rect x="0" y="416" width="${W}" height="184" fill="url(#deck)"/>
    ${Array.from({ length: 14 }, (_, i) => `<line x1="0" y1="${420 + i * 13}" x2="800" y2="${420 + i * 13}" stroke="#a98860" stroke-width="2" opacity="0.5"/>`).join('')}
    <rect x="0" y="404" width="${W}" height="16" fill="#c4a37c"/>
    <g>
      ${[40, 150, 640, 730].map((x) => `<g><rect x="${x}" y="316" width="86" height="92" rx="8" fill="#e5d7c2"/>${bush(x + 43, 306, 40, '#4aa473')}<circle cx="${x + 18}" cy="290" r="18" fill="#8ed3a4"/><circle cx="${x + 70}" cy="296" r="16" fill="#2f7d54"/></g>`).join('')}
    </g>
    <g>
      <rect x="250" y="358" width="300" height="16" rx="8" fill="#f4ece1"/>
      <rect x="268" y="374" width="14" height="60" fill="#e0d4c2"/><rect x="518" y="374" width="14" height="60" fill="#e0d4c2"/>
      <rect x="236" y="392" width="40" height="42" rx="8" fill="#efe4d2"/><rect x="524" y="392" width="40" height="42" rx="8" fill="#efe4d2"/>
      <circle cx="400" cy="344" r="16" fill="#ffd166"/>
      <rect x="330" y="340" width="60" height="18" rx="9" fill="#e9dfcd"/>
    </g>
    ${parasol(620, 404, 0.9, '#e0785a')}
    ${potted(120, 470, 0.85)}
    <g stroke="#ffd166" stroke-width="4">
      <path d="M40 240 q 380 -60 720 -20" fill="none" opacity="0.8"/>
    </g>
    ${Array.from({ length: 11 }, (_, i) => `<circle cx="${60 + i * 68}" cy="${236 - Math.sin(i / 2) * 10}" r="7" fill="#fff0c2"/>`).join('')}`
  );
};

/** Slabs drawn in perspective towards a vanishing point above the horizon. */
function pavingPerspective(horizon, vpX, vpY, joint = '#c3b8a5') {
  let out = '';
  const rows = 7;
  for (let i = 1; i <= rows; i += 1) {
    const y = horizon + (H - horizon) * Math.pow(i / rows, 1.7);
    out += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="${joint}" stroke-width="4"/>`;
  }
  for (let xb = -520; xb <= W + 520; xb += 130) {
    const t = (H - horizon) / (H - vpY);
    const xTop = xb + t * (vpX - xb);
    out += `<line x1="${xb}" y1="${H}" x2="${xTop.toFixed(1)}" y2="${horizon}" stroke="${joint}" stroke-width="4"/>`;
  }
  return `<g>${out}</g>`;
}

scenes['green-courtyard'] = () => {
  const s = sky('sky', '#cfe9ff', '#f7fbff');
  const shutters = [140, 330, 520].map(
    (x) => `<g>
      <rect x="${x}" y="150" width="86" height="150" rx="8" fill="#cfe0ea" stroke="#ffffff" stroke-width="7"/>
      <line x1="${x + 43}" y1="150" x2="${x + 43}" y2="300" stroke="#ffffff" stroke-width="6"/>
      <rect x="${x - 26}" y="148" width="24" height="154" rx="4" fill="#5f8f74"/>
      <rect x="${x + 88}" y="148" width="24" height="154" rx="4" fill="#5f8f74"/>
      <path d="M${x - 10} 140 q ${53} -28 ${106} 0 Z" fill="#e8dcc8"/>
    </g>`
  ).join('');
  return svg(
    `${s.def}${linear('render', '#f7f0e4', '#e6dac8')}`,
    `${s.body}
    <rect x="0" y="40" width="${W}" height="350" fill="url(#render)"/>
    <rect x="0" y="26" width="${W}" height="24" fill="#d9ccb8"/>
    ${shutters}
    <rect x="640" y="190" width="104" height="200" rx="8" fill="#3c6e55"/>
    <rect x="632" y="178" width="120" height="18" rx="6" fill="#e8dcc8"/>
    <circle cx="726" cy="296" r="7" fill="${C.sun}"/>
    <rect x="0" y="378" width="${W}" height="18" fill="#d5c8b2"/>
    <rect x="0" y="390" width="${W}" height="210" fill="#e9e0ce"/>
    ${pavingPerspective(390, 400, 210)}
    ${tree(110, 476, 280, '#2f7d54', '#3f9c6b')}
    ${tree(676, 492, 240, '#357f58', '#4aa473')}
    <g opacity="0.16"><ellipse cx="116" cy="484" rx="104" ry="18" fill="${C.ink}"/><ellipse cx="680" cy="498" rx="92" ry="16" fill="${C.ink}"/></g>
    ${potted(86, 520, 0.95)}${potted(730, 534, 1)}
    <g transform="translate(400 496)">
      <ellipse cx="0" cy="-6" rx="74" ry="20" fill="#f6efe2"/>
      <ellipse cx="0" cy="-10" rx="74" ry="20" fill="#fdf8ef"/>
      <rect x="-8" y="6" width="16" height="52" fill="#d9ccb8"/>
      <ellipse cx="0" cy="60" rx="34" ry="10" fill="#e0d4c0"/>
      <g fill="#efe4d2"><rect x="-134" y="-2" width="44" height="14" rx="7"/><rect x="90" y="-2" width="44" height="14" rx="7"/></g>
      <g fill="#e6d9c4"><rect x="-130" y="12" width="10" height="44"/><rect x="120" y="12" width="10" height="44"/></g>
    </g>
    <g opacity="0.22">${Array.from({ length: 4 }, (_, i) => `<ellipse cx="${250 + i * 90}" cy="${548 + (i % 2) * 26}" rx="52" ry="14" fill="#ffffff"/>`).join('')}</g>`
  );
};

scenes['green-paved'] = () => {
  const s = sky('sky', '#d6e8f5', '#f8fbfd');
  const climber = Array.from({ length: 14 }, (_, i) => {
    const x = 470 + i * 22;
    const y = 300 - ((i * 41) % 60);
    return `<circle cx="${x}" cy="${y}" r="${12 + (i % 3) * 5}" fill="${i % 2 ? '#3f9c6b' : '#2f7d54'}"/>`;
  }).join('');
  return svg(
    `${s.def}${linear('render', '#efe7da', '#ddd3c2')}`,
    `${s.body}${cloud(140, 92, 0.8, 0.5)}
    <rect x="0" y="130" width="${W}" height="240" fill="url(#render)"/>
    <rect x="0" y="116" width="${W}" height="22" rx="4" fill="#cdc2ae"/>
    <g opacity="0.35">${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${150 + i * 32}" x2="800" y2="${150 + i * 32}" stroke="#cfc4b1" stroke-width="2"/>`).join('')}</g>
    <g>
      <rect x="104" y="192" width="132" height="178" rx="6" fill="#6b5340"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${112 + i * 25}" y="200" width="17" height="162" rx="3" fill="#7d6149"/>`).join('')}
      <circle cx="222" cy="288" r="8" fill="#c9bfae"/>
      <rect x="96" y="180" width="148" height="16" rx="6" fill="#cdc2ae"/>
    </g>
    <g>
      <g stroke="#cfc4b1" stroke-width="5">
        ${Array.from({ length: 7 }, (_, i) => `<line x1="${460 + i * 52}" y1="176" x2="${460 + i * 52}" y2="352"/>`).join('')}
        ${Array.from({ length: 4 }, (_, i) => `<line x1="460" y1="${190 + i * 52}" x2="772" y2="${190 + i * 52}"/>`).join('')}
      </g>
      <path d="M470 330 q 60 -34 150 -18 t 154 -10" stroke="#2f7d54" stroke-width="7" fill="none"/>
      ${climber}
    </g>
    <rect x="0" y="356" width="${W}" height="18" fill="#cfc4b1"/>
    <rect x="0" y="368" width="${W}" height="232" fill="#ded4c4"/>
    ${pavingPerspective(368, 400, 190, '#bdb19c')}
    <g>
      <rect x="250" y="404" width="300" height="20" rx="8" fill="#f2ebdd"/>
      <rect x="264" y="424" width="18" height="64" fill="#ddd0ba"/><rect x="518" y="424" width="18" height="64" fill="#ddd0ba"/>
      <g fill="#f7f1e5" stroke="#e0d4c0" stroke-width="3">
        <rect x="216" y="418" width="46" height="50" rx="10"/><rect x="538" y="418" width="46" height="50" rx="10"/>
      </g>
      <rect x="360" y="386" width="80" height="20" rx="10" fill="#ddd0ba"/>
    </g>
    <g>
      <rect x="60" y="430" width="120" height="120" rx="10" fill="#efe6d6" stroke="#d8ccb8" stroke-width="5"/>
      <circle cx="120" cy="416" r="52" fill="#3f9c6b"/><circle cx="96" cy="392" r="24" fill="#5fb684"/>
    </g>
    <g>
      <rect x="640" y="452" width="110" height="110" rx="10" fill="#efe6d6" stroke="#d8ccb8" stroke-width="5"/>
      <circle cx="695" cy="438" r="48" fill="#357f58"/><circle cx="718" cy="418" r="22" fill="#5fb684"/>
    </g>
    <g transform="translate(400 330)">
      <rect x="-14" y="-40" width="28" height="40" rx="6" fill="#b9c6d2"/>
      <path d="M-20 -40 L20 -40 L0 -62 Z" fill="#cfd9e4"/>
    </g>`
  );
};

/* --- layout ---------------------------------------------------------- */

scenes['layout-open'] = () =>
  planBase(`
    ${planFrame(70, 80, 660, 440)}
    ${wall(70, 300, 200, 300)}
    ${wall(200, 300, 200, 520)}
    ${doorSwing(200, 300, 54, 0)}
    ${kitchenRun(240, 110, 300, 54, true)}
    ${planLabel(390, 236, 'KITCHEN')}
    ${diningSet(600, 200, 40)}
    ${planLabel(600, 290, 'DINING')}
    ${sofa(300, 380, 180, 54)}
    ${furn(330, 460, 120, 30, 6)}
    ${planLabel(390, 420, 'LIVING')}
    ${furn(560, 360, 130, 130, 8, '#e9eff5')}
    ${planLabel(625, 432, 'TERRACE', 15)}
    ${furn(96, 340, 78, 100, 6)}
    ${planLabel(135, 480, 'UTILITY', 14)}
    <g stroke="#c0b6a6" stroke-width="3" stroke-dasharray="10 10">
      <line x1="240" y1="300" x2="700" y2="300"/>
    </g>
    <text x="400" y="556" font-family="Verdana, Geneva, sans-serif" font-size="20" letter-spacing="6" fill="#a99e8d" text-anchor="middle">ONE ROOM, NO DOORS</text>
  `);

scenes['layout-separate'] = () =>
  planBase(`
    ${planFrame(70, 80, 660, 440)}
    ${wall(400, 80, 400, 520)}
    ${wall(70, 300, 400, 300)}
    ${doorSwing(400, 180, 56, 90)}
    ${doorSwing(300, 300, 56, 0)}
    ${kitchenRun(110, 110, 240, 50, false)}
    ${furn(180, 200, 110, 60, 6)}
    ${planLabel(235, 262, 'KITCHEN')}
    ${diningSet(235, 410, 42)}
    ${planLabel(235, 500, 'DINING')}
    ${sofa(470, 150, 190, 56)}
    ${furn(500, 250, 130, 34, 6)}
    ${planLabel(565, 330, 'LIVING')}
    ${furn(460, 370, 100, 120, 8, '#e9eff5')}
    ${planLabel(510, 508, 'STUDY', 15)}
    ${furn(600, 380, 100, 60, 6)}
    ${planLabel(650, 470, 'HALL', 14)}
    <text x="400" y="556" font-family="Verdana, Geneva, sans-serif" font-size="20" letter-spacing="6" fill="#a99e8d" text-anchor="middle">DOORS THAT CLOSE</text>
  `);

scenes['layout-broken'] = () =>
  planBase(`
    ${planFrame(70, 80, 660, 440)}
    ${wall(480, 80, 480, 230)}
    ${wall(480, 360, 480, 520)}
    ${wall(70, 330, 230, 330)}
    ${kitchenRun(110, 110, 260, 50, true)}
    ${planLabel(240, 250, 'KITCHEN')}
    ${diningSet(360, 400, 40)}
    ${planLabel(360, 492, 'DINING')}
    ${sofa(540, 140, 150, 50)}
    ${furn(560, 230, 110, 30, 6)}
    ${planLabel(600, 300, 'SNUG')}
    ${furn(540, 400, 150, 90, 8, '#e9eff5')}
    ${planLabel(615, 508, 'GARDEN ROOM', 14)}
    ${furn(96, 360, 110, 130, 6)}
    ${planLabel(150, 508, 'PANTRY', 14)}
    <g stroke="#c0b6a6" stroke-width="4" stroke-dasharray="12 10"><line x1="480" y1="230" x2="480" y2="360"/></g>
    <text x="400" y="556" font-family="Verdana, Geneva, sans-serif" font-size="20" letter-spacing="6" fill="#a99e8d" text-anchor="middle">OPEN, WITH ONE DOOR</text>
  `);

scenes['layout-office'] = () =>
  planBase(`
    ${planFrame(70, 80, 660, 440)}
    ${wall(70, 320, 330, 320)}
    ${wall(330, 320, 330, 520)}
    ${doorSwing(330, 400, 56, 90)}
    <rect x="80" y="330" width="250" height="180" fill="#ffeede"/>
    ${furn(110, 356, 190, 54, 6, '#f3dcc4')}
    <circle cx="205" cy="436" r="20" fill="#dfe6ee" stroke="#9aa7b4" stroke-width="3"/>
    ${planLabel(205, 492, 'HOME OFFICE', 17)}
    <circle cx="300" cy="376" r="12" fill="#a8d5bd"/>
    ${sofa(430, 150, 180, 54)}
    ${planLabel(520, 262, 'LIVING')}
    ${kitchenRun(430, 400, 240, 46, false)}
    ${planLabel(550, 490, 'KITCHEN')}
    ${furn(120, 120, 150, 150, 8, '#e9eff5')}
    ${planLabel(195, 292, 'HALL', 15)}
    <text x="400" y="560" font-family="Verdana, Geneva, sans-serif" font-size="19" letter-spacing="5" fill="#a99e8d" text-anchor="middle">A DOOR YOU CAN SHUT ON WORK</text>
  `);

scenes['layout-atrium'] = () => {
  const s = sky('sky', '#f8f4ee', '#efe7da');
  const balustrade = (x, w) =>
    `<g>
      <rect x="${x}" y="292" width="${w}" height="12" rx="6" fill="#c3b49b"/>
      ${Array.from({ length: Math.floor(w / 26) }, (_, i) => `<rect x="${x + 10 + i * 26}" y="292" width="7" height="58" rx="3" fill="#d3c6b0"/>`).join('')}
      <rect x="${x}" y="344" width="${w}" height="10" rx="5" fill="#c3b49b"/>
    </g>`;
  return svg(
    `${s.def}${linear('atriumglass', '#e2eef6', '#a8cbe2')}${linear('beam', '#fff6dd', '#fff6dd')}`,
    `${s.body}
    <rect x="56" y="56" width="688" height="492" rx="8" fill="#fbf8f3" stroke="#d8cdb9" stroke-width="10"/>
    <g>
      <rect x="290" y="96" width="220" height="392" rx="6" fill="url(#atriumglass)" stroke="#ffffff" stroke-width="12"/>
      <line x1="400" y1="96" x2="400" y2="488" stroke="#ffffff" stroke-width="10"/>
      <line x1="290" y1="290" x2="510" y2="290" stroke="#ffffff" stroke-width="10"/>
    </g>
    <g opacity="0.55">
      <path d="M300 108 L150 488 L300 488 Z" fill="url(#beam)"/>
      <path d="M498 108 L640 488 L498 488 Z" fill="url(#beam)"/>
    </g>
    <g>
      <rect x="56" y="350" width="234" height="18" fill="#c3b49b"/>
      <rect x="510" y="350" width="234" height="18" fill="#c3b49b"/>
      ${balustrade(200, 90)}${balustrade(510, 90)}
    </g>
    <g>
      ${bed(96, 190, 86, 110)}
      ${furn(200, 200, 70, 40, 6)}
      ${planLabel(150, 168, 'MEZZANINE', 15)}
      ${furn(600, 196, 110, 44, 6)}
      ${furn(620, 262, 70, 70, 8, '#e9eff5')}
      ${planLabel(658, 168, 'GALLERY', 15)}
    </g>
    <g>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${72 + i * 21}" y="${488 - (i + 1) * 15}" width="21" height="15" fill="#e2d6c1" stroke="#cdbfa8" stroke-width="2"/>`).join('')}
      <rect x="64" y="486" width="220" height="12" fill="#c3b49b"/>
    </g>
    <rect x="56" y="488" width="688" height="60" fill="#e8dfcf"/>
    ${sofa(300, 420, 180, 52)}
    ${furn(324, 484, 132, 12, 6)}
    ${potted(596, 488, 0.85)}${potted(262, 488, 0.6)}
    <g><rect x="396" y="96" width="10" height="150" fill="#c3b49b"/><path d="M370 246 L432 246 L414 282 L388 282 Z" fill="#f2e4c2"/></g>
    <g stroke="#a9997f" stroke-width="3" fill="none">
      <path d="M544 116 L544 472"/>
      <path d="M536 124 L544 108 L552 124"/><path d="M536 464 L544 480 L552 464"/>
    </g>
    <rect x="520" y="278" width="52" height="28" rx="6" fill="#fbf8f3"/>
    <text x="546" y="298" font-family="Verdana, Geneva, sans-serif" font-size="16" letter-spacing="1" fill="#a9997f" text-anchor="middle">6.2 m</text>`
  );
};

scenes['layout-loft'] = () => {
  const s = sky('sky', '#d9ecff', '#f7fbff');
  return svg(
    `${s.def}${linear('loftlight', '#fff7e2', '#f7ead0')}`,
    `${s.body}${cloud(650, 92, 0.8, 0.55)}${sun(112, 96, 38)}
    <rect x="0" y="536" width="${W}" height="64" fill="#8ec79f"/>
    <g>
      <rect x="150" y="318" width="500" height="222" fill="#f2ede4" stroke="#cdbfa8" stroke-width="5"/>
      <path d="M126 322 L400 146 L674 322 Z" fill="url(#loftlight)" stroke="#cdbfa8" stroke-width="6"/>
      <rect x="150" y="424" width="500" height="10" fill="#cdbfa8"/>
      <rect x="150" y="312" width="500" height="14" fill="#cdbfa8"/>
    </g>
    <g>
      <path d="M470 218 L534 260 L512 296 L448 254 Z" fill="#cfe6f3" stroke="#ffffff" stroke-width="7"/>
      <path d="M488 230 L502 276" stroke="#ffffff" stroke-width="5"/>
      <path d="M534 260 L600 220 L612 250 L548 292 Z" fill="#fff6dd" opacity="0.6"/>
    </g>
    <g>
      ${bed(236, 228, 130, 74)}
      ${furn(200, 250, 30, 52, 6)}
      ${furn(380, 236, 60, 66, 6, '#e9eff5')}
      <circle cx="410" cy="222" r="11" fill="#f2e4c2"/>
      ${furn(548, 262, 86, 40, 6)}
      ${planLabel(300, 200, 'LOFT SUITE', 18)}
      <line x1="230" y1="302" x2="620" y2="302" stroke="#d8cbb4" stroke-width="4"/>
    </g>
    <g opacity="0.7">
      <rect x="164" y="336" width="150" height="80" rx="6" fill="#eef2f6" stroke="#c9d3dc" stroke-width="3"/>
      <rect x="326" y="336" width="150" height="80" rx="6" fill="#eef2f6" stroke="#c9d3dc" stroke-width="3"/>
      <rect x="488" y="336" width="148" height="80" rx="6" fill="#eef2f6" stroke="#c9d3dc" stroke-width="3"/>
      ${planLabel(400, 396, 'BEDROOMS', 15)}
      <rect x="164" y="444" width="310" height="86" rx="6" fill="#eef2f6" stroke="#c9d3dc" stroke-width="3"/>
      <rect x="486" y="444" width="150" height="86" rx="6" fill="#eef2f6" stroke="#c9d3dc" stroke-width="3"/>
      ${planLabel(319, 502, 'LIVING', 15)}
      ${planLabel(561, 502, 'KITCHEN', 15)}
    </g>
    <g stroke="#a9997f" stroke-width="3" fill="none">
      <path d="M700 168 L700 300"/><path d="M692 176 L700 160 L708 176"/><path d="M692 292 L700 308 L708 292"/>
    </g>
    <text x="712" y="242" font-family="Verdana, Geneva, sans-serif" font-size="15" letter-spacing="1" fill="#a9997f">2.6 m</text>
    ${tree(76, 556, 160)}${tree(736, 562, 140)}`
  );
};

/* --- pools ----------------------------------------------------------- */

scenes['pool-community'] = () => {
  const s = sky('sky', '#bfe4ff', '#f4fbff');
  return svg(
    `${s.def}${linear('water', '#63cbe6', '#1f94c0')}${linear('block', '#f2f5f8', '#dde5ec')}`,
    `${s.body}${sun(120, 100, 48)}${cloud(560, 96, 1, 0.65)}
    <g>
      <rect x="40" y="150" width="200" height="230" fill="url(#block)"/>
      ${windowGrid(40, 166, 200, 200, 4, 5, '#bcd7e8', 10)}
      <rect x="28" y="138" width="224" height="16" rx="6" fill="#e3ebf1"/>
      <rect x="560" y="120" width="210" height="260" fill="url(#block)"/>
      ${windowGrid(560, 138, 210, 226, 4, 6, '#bcd7e8', 10)}
      <rect x="548" y="108" width="234" height="16" rx="6" fill="#e3ebf1"/>
      <rect x="260" y="230" width="290" height="150" fill="#eef3f7"/>
      ${windowGrid(260, 246, 290, 120, 6, 3, '#c7dcea', 10)}
    </g>
    <rect x="0" y="380" width="${W}" height="220" fill="#f0e6d4"/>
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${396 + i * 36}" x2="800" y2="${396 + i * 36}" stroke="#e3d7c1" stroke-width="3"/>`).join('')}
    ${waterBody(120, 420, 560, 150, 26)}
    <g>
      ${Array.from({ length: 5 }, (_, i) => `<line x1="${180 + i * 110}" y1="424" x2="${180 + i * 110}" y2="566" stroke="#ffffff" stroke-width="4" opacity="0.35"/>`).join('')}
    </g>
    ${lounger(30, 470, 0.9)}${lounger(30, 540, 0.9)}
    ${lounger(770, 470, 0.9, true)}${lounger(770, 540, 0.9, true)}
    ${parasol(96, 460, 0.8, '#4fb3d9')}${parasol(706, 456, 0.8, '#4fb3d9')}
    <g fill="#ffffff" opacity="0.85">
      <circle cx="300" cy="470" r="13"/><circle cx="470" cy="520" r="13"/>
    </g>
    <g stroke="#ffffff" stroke-width="5" opacity="0.6" fill="none">
      <path d="M280 486 q 20 -14 40 0"/><path d="M450 536 q 20 -14 40 0"/>
    </g>
    ${potted(400, 408, 0.55)}
    ${bush(60, 404, 24)}${bush(740, 404, 26)}`
  );
};

scenes['pool-private'] = () => {
  const s = sky('sky', '#c6e6ff', '#fdf5e8');
  return svg(
    `${s.def}${linear('water', '#57c7e4', '#1d8fbd')}`,
    `${s.body}${sun(680, 110, 52)}
    <rect x="0" y="330" width="${W}" height="270" fill="#eee4d2"/>
    <g>
      <rect x="60" y="150" width="420" height="200" fill="#fbf8f3"/>
      <rect x="44" y="136" width="452" height="18" rx="6" fill="#efe7da"/>
      <rect x="96" y="182" width="150" height="150" rx="6" fill="#bcdcee" stroke="#ffffff" stroke-width="8"/>
      <rect x="278" y="182" width="170" height="150" rx="6" fill="#cfe4f0" stroke="#ffffff" stroke-width="8"/>
      <line x1="363" y1="182" x2="363" y2="332" stroke="#ffffff" stroke-width="8"/>
    </g>
    ${tree(600, 344, 220, '#2f7d54', '#46a06c')}
    ${tree(730, 356, 180)}
    <rect x="0" y="350" width="${W}" height="14" fill="#e0d4bf"/>
    ${waterBody(150, 396, 520, 156, 20)}
    <g>
      <rect x="150" y="386" width="520" height="14" rx="7" fill="#f6efe2"/>
      <rect x="150" y="548" width="520" height="14" rx="7" fill="#f6efe2"/>
    </g>
    <g>
      <rect x="600" y="404" width="10" height="60" rx="5" fill="#dcd0ba"/>
      <rect x="560" y="398" width="60" height="10" rx="5" fill="#f2ead9"/>
    </g>
    ${lounger(60, 430, 0.95)}${parasol(120, 418, 0.85, '#e0a05a')}
    ${lounger(690, 470, 0.95, true)}
    ${potted(712, 560, 0.7)}
    <g fill="none" stroke="#ffffff" stroke-width="5" opacity="0.5">
      <path d="M220 460 q 24 -16 48 0 t 48 0"/>
    </g>
    ${bush(70, 356, 26)}${bush(506, 358, 30, C.leafLight)}`
  );
};

scenes['pool-plunge'] = () => {
  const s = sky('sky', '#d5ecff', '#fbf6ec');
  return svg(
    `${s.def}${linear('water', '#4fc3e0', '#1b86b5')}`,
    `${s.body}
    <rect x="0" y="0" width="${W}" height="340" fill="#f1e8da"/>
    <g>
      <rect x="0" y="40" width="${W}" height="300" fill="#f6efe4"/>
      <rect x="0" y="26" width="${W}" height="22" fill="#e6dac6"/>
      ${[80, 300, 560].map((x) => `<rect x="${x}" y="110" width="110" height="160" rx="10" fill="#cfe2ee" stroke="#ffffff" stroke-width="8"/>`).join('')}
      <rect x="440" y="150" width="90" height="190" rx="8" fill="#3c6e55"/>
    </g>
    <rect x="0" y="340" width="${W}" height="260" fill="#e9dfcc"/>
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${360 + i * 42}" x2="800" y2="${360 + i * 42}" stroke="#ddd0b8" stroke-width="3"/>`).join('')}
    ${waterBody(250, 400, 300, 150, 16)}
    <rect x="240" y="390" width="320" height="12" rx="6" fill="#f6efe2"/>
    <rect x="240" y="548" width="320" height="12" rx="6" fill="#f6efe2"/>
    ${tree(120, 380, 210, '#2f7d54', '#46a06c')}
    ${potted(640, 420, 1)}${potted(700, 506, 0.8)}
    ${bush(180, 420, 34, '#4aa473')}
    ${lounger(70, 470, 0.85)}
    <g fill="none" stroke="#ffffff" stroke-width="5" opacity="0.55">
      <path d="M300 448 q 22 -14 44 0 t 44 0"/>
    </g>
    <g opacity="0.25"><ellipse cx="400" cy="576" rx="230" ry="16" fill="${C.ink}"/></g>`
  );
};

scenes['pool-none'] = () => {
  const s = sky('sky', '#cbe8ff', '#f6fcff');
  return svg(
    `${s.def}`,
    `${s.body}${sun(660, 110, 46)}${cloud(200, 110, 0.95, 0.7)}
    <rect x="0" y="330" width="${W}" height="270" fill="#79c999"/>
    <path d="M0 330 q 200 -40 400 -8 t 400 -12 L800 600 L0 600 Z" fill="#69bd8b"/>
    ${Array.from({ length: 6 }, (_, i) => `<path d="M${-40 + i * 150} 600 q 120 -120 260 -180" stroke="#72c491" stroke-width="30" fill="none" opacity="0.5"/>`).join('')}
    ${pitchedHouse(310, 336, 190, 88, { roof: '#5c6f85' })}
    ${tree(120, 380, 220, '#2f7d54', '#44a06d')}
    ${tree(690, 396, 190)}
    ${bush(250, 400, 34)}${bush(560, 408, 30, C.leafLight)}
    ${flowers(230, 440, 5, 120, ['#f2a2c0', '#ffd166', '#ffffff'])}
    <g transform="translate(400 470)">
      <rect x="-90" y="-8" width="180" height="14" rx="7" fill="#efe4d2"/>
      <rect x="-70" y="6" width="14" height="46" fill="#d9ccb8"/><rect x="56" y="6" width="14" height="46" fill="#d9ccb8"/>
      <rect x="-120" y="12" width="40" height="14" rx="7" fill="#efe4d2"/><rect x="80" y="12" width="40" height="14" rx="7" fill="#efe4d2"/>
    </g>
    <g>
      <rect x="600" y="470" width="120" height="70" rx="8" fill="#e6dccb"/>
      <path d="M594 470 L660 430 L726 470 Z" fill="#8b5a44"/>
      <rect x="640" y="500" width="40" height="40" fill="#c8b79e"/>
    </g>
    <g opacity="0.3"><ellipse cx="400" cy="512" rx="150" ry="14" fill="${C.ink}"/></g>`
  );
};

/* --- extras ---------------------------------------------------------- */

scenes['extra-garage'] = () => {
  const s = sky('sky', '#cfe9ff', '#f6fbff');
  return svg(
    `${s.def}${linear('door', '#e9eef2', '#cbd5dd')}`,
    `${s.body}${cloud(180, 106, 0.9, 0.6)}${sun(690, 116, 44)}
    <rect x="0" y="380" width="${W}" height="220" fill="#7ec89a"/>
    <path d="M250 600 L320 400 L520 400 L640 600 Z" fill="#d8d2c6"/>
    ${Array.from({ length: 5 }, (_, i) => `<line x1="${300 + i * 8}" y1="${580 - i * 40}" x2="${560 - i * 12}" y2="${580 - i * 40}" stroke="#c6bfb0" stroke-width="3"/>`).join('')}
    <g>
      <rect x="180" y="230" width="440" height="180" fill="#fbf7f1"/>
      <path d="M160 232 L400 130 L640 232 Z" fill="#5c6f85"/>
      <rect x="320" y="262" width="180" height="148" rx="8" fill="url(#door)" stroke="#b9c2ca" stroke-width="5"/>
      ${Array.from({ length: 5 }, (_, i) => `<line x1="320" y1="${290 + i * 28}" x2="500" y2="${290 + i * 28}" stroke="#b9c2ca" stroke-width="4"/>`).join('')}
      <rect x="210" y="280" width="80" height="70" rx="4" fill="${C.glass}" stroke="#ffffff" stroke-width="6"/>
      <rect x="530" y="280" width="70" height="70" rx="4" fill="${C.glass}" stroke="#ffffff" stroke-width="6"/>
    </g>
    <g transform="translate(400 470)">
      <path d="M-110 0 q 14 -54 40 -60 l 140 0 q 30 8 44 60 Z" fill="#3f6fa8"/>
      <path d="M-70 -18 q 10 -30 26 -34 l 86 0 q 20 6 30 34 Z" fill="#cfe4f2"/>
      <rect x="-114" y="0" width="230" height="28" rx="12" fill="#325b8c"/>
      <circle cx="-64" cy="28" r="22" fill="#2b3440"/><circle cx="-64" cy="28" r="9" fill="#9aa7b4"/>
      <circle cx="66" cy="28" r="22" fill="#2b3440"/><circle cx="66" cy="28" r="9" fill="#9aa7b4"/>
    </g>
    ${tree(90, 420, 170)}${bush(690, 426, 32)}${bush(736, 432, 24, C.leafLight)}
    <g opacity="0.25"><ellipse cx="400" cy="516" rx="140" ry="14" fill="${C.ink}"/></g>`
  );
};

scenes['extra-station'] = () => {
  const s = sky('sky', '#cfe4f5', '#f8fbfd');
  return svg(
    `${s.def}${linear('train', '#f0f4f7', '#c9d5de')}`,
    `${s.body}${cloud(140, 104, 0.85, 0.55)}
    <g opacity="0.4" fill="#8aa6bf">
      <rect x="20" y="180" width="110" height="200"/><rect x="150" y="220" width="80" height="160"/>
      <rect x="600" y="200" width="100" height="180"/><rect x="720" y="240" width="70" height="140"/>
    </g>
    <rect x="0" y="380" width="${W}" height="220" fill="#e6dfd3"/>
    <rect x="0" y="470" width="${W}" height="20" fill="#b9b2a4"/>
    <g>
      <rect x="0" y="502" width="${W}" height="10" fill="#8d9aa8"/>
      <rect x="0" y="540" width="${W}" height="10" fill="#8d9aa8"/>
      ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 60}" y="496" width="34" height="60" rx="4" fill="#9c8f7c"/>`).join('')}
    </g>
    <g>
      <rect x="120" y="300" width="470" height="170" rx="26" fill="url(#train)" stroke="#aebbc6" stroke-width="5"/>
      <rect x="120" y="360" width="470" height="18" fill="${C.terracotta}"/>
      ${[150, 260, 370, 480].map((x) => `<rect x="${x}" y="316" width="80" height="60" rx="8" fill="#bcd9ea" stroke="#ffffff" stroke-width="5"/>`).join('')}
      <rect x="560" y="330" width="34" height="90" rx="10" fill="#bcd9ea"/>
      <circle cx="200" cy="480" r="20" fill="#54626f"/><circle cx="300" cy="480" r="20" fill="#54626f"/>
      <circle cx="430" cy="480" r="20" fill="#54626f"/><circle cx="520" cy="480" r="20" fill="#54626f"/>
    </g>
    <g>
      <rect x="640" y="250" width="150" height="16" rx="8" fill="#5c6f85"/>
      <rect x="706" y="266" width="14" height="204" fill="#8d9aa8"/>
      <rect x="628" y="240" width="174" height="14" rx="7" fill="#42505e"/>
      <rect x="648" y="290" width="130" height="44" rx="8" fill="#2f3c4a"/>
      <text x="713" y="320" font-family="Verdana, Geneva, sans-serif" font-size="22" fill="#8ed3a4" text-anchor="middle">5 min</text>
    </g>
    ${bush(60, 470, 30)}${potted(660, 470, 0.7)}
    <g transform="translate(626 400)">
      <circle cx="0" cy="-40" r="16" fill="#3f6fa8"/>
      <rect x="-14" y="-22" width="28" height="46" rx="10" fill="#4f7fb8"/>
      <rect x="-12" y="24" width="10" height="38" rx="5" fill="#33414f"/><rect x="2" y="24" width="10" height="38" rx="5" fill="#33414f"/>
    </g>`
  );
};

scenes['extra-gated'] = () => {
  const s = sky('sky', '#cfe9ff', '#f6fbff');
  return svg(
    `${s.def}${linear('gate', '#5c6f85', '#3b4857')}`,
    `${s.body}${cloud(620, 110, 0.9, 0.6)}${sun(140, 110, 42)}
    <rect x="0" y="360" width="${W}" height="240" fill="#82cb9c"/>
    <rect x="0" y="430" width="${W}" height="170" fill="#d8d2c6"/>
    <path d="M300 600 L340 430 L470 430 L520 600 Z" fill="#c8c1b3"/>
    <g>
      <rect x="0" y="286" width="230" height="150" fill="#efe7da"/>
      <rect x="0" y="272" width="240" height="20" rx="6" fill="#ded4c2"/>
      <rect x="570" y="286" width="230" height="150" fill="#efe7da"/>
      <rect x="560" y="272" width="240" height="20" rx="6" fill="#ded4c2"/>
      ${Array.from({ length: 4 }, (_, i) => `<rect x="${30 + i * 52}" y="316" width="30" height="60" rx="4" fill="#d5cbb8"/>`).join('')}
      ${Array.from({ length: 4 }, (_, i) => `<rect x="${600 + i * 52}" y="316" width="30" height="60" rx="4" fill="#d5cbb8"/>`).join('')}
    </g>
    <g>
      <rect x="220" y="230" width="34" height="206" rx="6" fill="url(#gate)"/>
      <rect x="546" y="230" width="34" height="206" rx="6" fill="url(#gate)"/>
      <circle cx="237" cy="218" r="16" fill="#42505e"/><circle cx="563" cy="218" r="16" fill="#42505e"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${264 + i * 30}" y="276" width="10" height="160" rx="5" fill="#4a5a6b"/>`).join('')}
      <rect x="254" y="276" width="292" height="12" rx="6" fill="#4a5a6b"/>
      <rect x="254" y="360" width="292" height="12" rx="6" fill="#4a5a6b"/>
      <circle cx="400" cy="318" r="26" fill="#d7c48a"/>
      <text x="400" y="326" font-family="Verdana, Geneva, sans-serif" font-size="20" fill="#6b5a2e" text-anchor="middle">24</text>
    </g>
    <g>
      <rect x="630" y="160" width="120" height="112" rx="10" fill="#fbf7f1" stroke="#ded4c2" stroke-width="5"/>
      <rect x="652" y="186" width="76" height="52" rx="6" fill="#bcd9ea"/>
      <path d="M620 162 L690 122 L760 162 Z" fill="#5c6f85"/>
      <circle cx="690" cy="252" r="9" fill="#8ed3a4"/>
    </g>
    ${tree(96, 436, 180)}${tree(716, 446, 150)}
    ${bush(180, 440, 30)}${bush(620, 444, 30, C.leafLight)}
    ${Array.from({ length: 5 }, (_, i) => `${bush(280 + i * 62, 452, 20, '#4aa473')}`).join('')}`
  );
};

scenes['extra-gym'] = () => {
  const s = sky('sky', '#f3f6f9', '#e6ecf1');
  const plate = (cx, cy, r) =>
    `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#33414f"/><circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="#54626f"/></g>`;
  return svg(
    `${s.def}${linear('mirror', '#e4edf3', '#c6d6e1')}${linear('rubber', '#4d5866', '#3b4552')}`,
    `${s.body}
    <rect x="0" y="0" width="${W}" height="452" fill="#f7f4ee"/>
    <rect x="0" y="452" width="${W}" height="148" fill="url(#rubber)"/>
    <rect x="0" y="444" width="${W}" height="14" fill="#5d6977"/>
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 100}" y1="452" x2="${i * 100 - 40}" y2="600" stroke="#434e5c" stroke-width="3"/>`).join('')}
    ${Array.from({ length: 3 }, (_, i) => `<line x1="0" y1="${490 + i * 42}" x2="800" y2="${490 + i * 42}" stroke="#434e5c" stroke-width="3"/>`).join('')}
    <g>
      <rect x="40" y="86" width="310" height="346" rx="8" fill="url(#mirror)" stroke="#ffffff" stroke-width="10"/>
      <path d="M64 414 L250 104 L300 104 L110 414 Z" fill="#ffffff" opacity="0.4"/>
      <path d="M300 414 L340 348 L346 414 Z" fill="#ffffff" opacity="0.25"/>
    </g>
    <g>
      <rect x="410" y="96" width="330" height="264" rx="8" fill="#cfe6f3" stroke="#ffffff" stroke-width="10"/>
      <line x1="575" y1="96" x2="575" y2="360" stroke="#ffffff" stroke-width="8"/>
      ${bush(660, 316, 46, '#4aa473')}${bush(470, 326, 38, '#2f7d54')}
      <circle cx="700" cy="160" r="26" fill="#ffe7a8" opacity="0.8"/>
    </g>
    <g>
      <rect x="410" y="380" width="330" height="18" rx="9" fill="#e6dccb"/>
      ${plate(452, 416, 20)}${plate(500, 416, 20)}
      ${plate(560, 414, 22)}${plate(612, 414, 22)}
      ${plate(676, 412, 24)}${plate(732, 412, 24)}
    </g>
    <g>
      <path d="M96 520 L300 520 L318 452 L150 452 Z" fill="#59657a"/>
      <path d="M104 512 L294 512 L308 462 L158 462 Z" fill="#2f3945"/>
      <rect x="300" y="360" width="16" height="104" rx="8" fill="#8d9aa8"/>
      <rect x="258" y="332" width="92" height="46" rx="8" fill="#39434f"/>
      <rect x="270" y="344" width="68" height="22" rx="4" fill="#7fd4e8"/>
      <rect x="216" y="372" width="120" height="12" rx="6" fill="#8d9aa8"/>
      <circle cx="104" cy="524" r="14" fill="#2b3440"/><circle cx="300" cy="524" r="14" fill="#2b3440"/>
    </g>
    <g>
      <rect x="392" y="474" width="190" height="22" rx="11" fill="#2b3440"/>
      ${plate(384, 485, 26)}${plate(590, 485, 26)}
      <rect x="430" y="496" width="120" height="26" rx="10" fill="${C.terracotta}"/>
      <rect x="440" y="522" width="14" height="40" fill="#5d6977"/><rect x="526" y="522" width="14" height="40" fill="#5d6977"/>
    </g>
    <g>
      <rect x="640" y="470" width="120" height="34" rx="17" fill="#8ed3a4"/>
      <rect x="640" y="470" width="120" height="34" rx="17" fill="none" stroke="#68b98a" stroke-width="3"/>
      <circle cx="700" cy="487" r="10" fill="#68b98a"/>
    </g>
    <g>
      <circle cx="376" cy="150" r="34" fill="#f7f4ee" stroke="#c9d3dc" stroke-width="6"/>
      <line x1="376" y1="150" x2="376" y2="130" stroke="#39434f" stroke-width="5" stroke-linecap="round"/>
      <line x1="376" y1="150" x2="392" y2="158" stroke="#39434f" stroke-width="5" stroke-linecap="round"/>
    </g>`
  );
};

/* ------------------------------------------------------------------- run */

function main() {
  const { CARDS } = require('../lib/deck');
  const outDir = path.join(__dirname, '..', 'public', 'img');
  fs.mkdirSync(outDir, { recursive: true });

  const expected = CARDS.filter((c) => c.image.startsWith('/img/')).map((c) =>
    path.basename(c.image, '.svg')
  );
  const missing = expected.filter((name) => !scenes[name]);
  if (missing.length) {
    console.error(`No scene defined for: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  let count = 0;
  for (const [name, draw] of Object.entries(scenes)) {
    fs.writeFileSync(path.join(outDir, `${name}.svg`), draw(), 'utf8');
    count += 1;
  }
  console.log(`Wrote ${count} illustrations to public/img`);
}

if (require.main === module) main();

module.exports = { scenes };
