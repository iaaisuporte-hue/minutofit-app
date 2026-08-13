/**
 * Gera os ícones e splashes do Android a partir da marca S2Core.
 *
 * Fonte: os PNGs já commitados em public/ (icon-512 e icon-maskable-512), que
 * foram renderizados com a tipografia certa. Re-renderizar o SVG aqui daria um
 * "S2" em DejaVu Sans (Manrope não está instalada no ambiente) e o ícone sairia
 * fora da marca — por isso partimos do raster existente e só redimensionamos.
 *
 * O que substitui: os assets default do template do Capacitor (o "X" azul),
 * que nunca foram trocados e reprovariam a submissão na Play Store.
 *
 * Uso (sharp não é dependência do app — instale sob demanda):
 *   npm i --no-save sharp && node scripts/gen-android-assets.mjs
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(APP_ROOT, 'public');
const RES = join(APP_ROOT, 'android/app/src/main/res');
/** Assets da ficha da loja: versionados na raiz do monorepo, fora do app. */
const OUT_STORE = join(APP_ROOT, '../../docs/store');

const INK = { r: 0x0a, g: 0x0a, b: 0x0a, alpha: 1 };

const SRC_ICON = join(PUBLIC, 'icon-512.png');       // quadrado arredondado, fundo escuro
const SRC_MASKABLE = join(PUBLIC, 'icon-maskable-512.png'); // full-bleed, marca na safe zone

const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SPLASH_PORT = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
const SPLASH_LAND = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };

/** Máscara circular, para o ic_launcher_round dos launchers que pedem círculo. */
function circleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
}

/**
 * Foreground do ícone adaptativo. O sistema recorta o composto na forma do
 * launcher e ainda aplica parallax: só os 72dp centrais de 108dp são
 * garantidos. Por isso a marca entra reduzida a 80% sobre canvas transparente —
 * como o fundo do adaptativo é o mesmo #0A0A0A da arte, a emenda é invisível.
 */
async function buildForeground(size) {
  const inner = Math.round(size * 0.8);
  const pad = Math.round((size - inner) / 2);
  const mark = await sharp(SRC_MASKABLE).resize(inner, inner).toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toBuffer();
}

/** Splash: fundo da marca com o ícone centralizado, ocupando ~28% do menor lado. */
async function buildSplash(width, height) {
  const markSize = Math.round(Math.min(width, height) * 0.28);
  const mark = await sharp(SRC_ICON).resize(markSize, markSize).toBuffer();
  return sharp({ create: { width, height, channels: 4, background: INK } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
}

const written = [];
function write(path, buf) {
  writeFileSync(path, buf);
  written.push(`${path.replace(RES, 'res').replace(OUT_STORE, 'docs/store')}  ${(buf.length / 1024).toFixed(1)} KB`);
}

// ── Launcher (legado quadrado + redondo) ───────────────────────────────────
for (const [density, size] of Object.entries(LAUNCHER)) {
  const dir = join(RES, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });

  write(join(dir, 'ic_launcher.png'), await sharp(SRC_ICON).resize(size, size).png().toBuffer());

  const round = await sharp(SRC_MASKABLE)
    .resize(size, size)
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer();
  write(join(dir, 'ic_launcher_round.png'), round);
}

// ── Foreground do ícone adaptativo ─────────────────────────────────────────
for (const [density, size] of Object.entries(FOREGROUND)) {
  write(join(RES, `mipmap-${density}`, 'ic_launcher_foreground.png'), await buildForeground(size));
}

// ── Splash ─────────────────────────────────────────────────────────────────
for (const [density, [w, h]] of Object.entries(SPLASH_PORT)) {
  const dir = join(RES, `drawable-port-${density}`);
  mkdirSync(dir, { recursive: true });
  write(join(dir, 'splash.png'), await buildSplash(w, h));
}
for (const [density, [w, h]] of Object.entries(SPLASH_LAND)) {
  const dir = join(RES, `drawable-land-${density}`);
  mkdirSync(dir, { recursive: true });
  write(join(dir, 'splash.png'), await buildSplash(w, h));
}
write(join(RES, 'drawable', 'splash.png'), await buildSplash(480, 320));

// ── Cor de fundo do ícone adaptativo ───────────────────────────────────────
writeFileSync(
  join(RES, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Fundo do ícone adaptativo: o mesmo tom da arte da marca, para que o
         foreground (que já traz esse fundo) não deixe emenda visível. -->
    <color name="ic_launcher_background">#0A0A0A</color>
</resources>
`,
);
written.push('res/values/ic_launcher_background.xml  #0A0A0A');

// ── Assets da ficha da Play Store ──────────────────────────────────────────
mkdirSync(OUT_STORE, { recursive: true });

// Ícone da loja: 512x512, 32-bit PNG, SEM transparência (exigência do Play).
write(
  join(OUT_STORE, 'play-icon-512.png'),
  await sharp(SRC_ICON).resize(512, 512).flatten({ background: INK }).png().toBuffer(),
);

// Feature graphic 1024x500: sem texto de propósito — a Play sobrepõe o nome do
// app e textos aqui costumam ficar cortados em telas menores.
const featureMark = await sharp(SRC_ICON).resize(300, 300).toBuffer();
write(
  join(OUT_STORE, 'play-feature-graphic-1024x500.png'),
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: INK } })
    .composite([{ input: featureMark, gravity: 'centre' }])
    .png()
    .toBuffer(),
);

console.log(written.join('\n'));
console.log(`\n${written.length} arquivos gerados.`);
