/**
 * Gera o ícone e o splash do iOS a partir da marca S2Core.
 *
 * Mesma premissa do gen-android-assets.mjs: parte dos PNGs já commitados em
 * public/ (renderizados com a tipografia certa) em vez de re-renderizar o SVG,
 * porque Manrope não está instalada no ambiente e o "S2" sairia em DejaVu Sans.
 *
 * O que substitui: o AppIcon e o Splash do template do Capacitor (o "X" azul),
 * que reprovariam a submissão na App Store.
 *
 * Duas saídas, e cada uma existe por um motivo diferente:
 *
 *  - `ios/App/App/Assets.xcassets/` — os assets nativos, dentro do bundle. Só
 *    são gravados se a pasta existir; `npx cap add ios` precisa ter rodado num
 *    ambiente com Xcode/CocoaPods. Sem ela o script segue e avisa.
 *  - `docs/store/ios/` — o ícone 1024×1024 da ficha da App Store Connect, que
 *    é enviado pelo site e não vive no projeto Xcode. Espelha o
 *    `docs/store/play-icon-512.png` do Android.
 *
 * O ícone sai SEM canal alpha: a App Store rejeita AppIcon com transparência
 * (a Play Store rejeita o da ficha pelo mesmo motivo).
 *
 * Uso (sharp não é dependência do app — instale sob demanda):
 *   npm i --no-save sharp && node scripts/gen-ios-assets.mjs
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(APP_ROOT, 'public');
const XCASSETS = join(APP_ROOT, 'ios/App/App/Assets.xcassets');
/** Assets da ficha da loja: versionados na raiz do monorepo, fora do app. */
const OUT_STORE = join(APP_ROOT, '../../docs/store/ios');

const INK = { r: 0x0a, g: 0x0a, b: 0x0a, alpha: 1 };

const SRC_ICON = join(PUBLIC, 'icon-512.png');       // quadrado arredondado, fundo escuro
const SRC_MASKABLE = join(PUBLIC, 'icon-maskable-512.png'); // full-bleed, marca na safe zone

/** Lado do splash universal do template do Capacitor (mesma arte nos 3 scales). */
const SPLASH_SIZE = 2732;

const written = [];
function write(path, buf) {
  writeFileSync(path, buf);
  written.push(
    `${path.replace(APP_ROOT + '/', '').replace(OUT_STORE, 'docs/store/ios')}  ${(buf.length / 1024).toFixed(1)} KB`,
  );
}

/**
 * AppIcon: 1024×1024 achatado sobre a cor da marca.
 *
 * `flatten` não é cosmético — o iOS recusa o ícone com canal alpha na
 * validação do binário, e o PNG de origem tem cantos transparentes.
 */
async function buildAppIcon() {
  return sharp(SRC_ICON).resize(1024, 1024).flatten({ background: INK }).png().toBuffer();
}

/**
 * Splash: quadrado do lado maior possível (o storyboard usa scaleAspectFill e
 * recorta para o formato da tela), com a marca ocupando ~22% do lado. Menor que
 * os 28% do Android porque aqui o quadrado é recortado nas duas orientações.
 */
async function buildSplash() {
  const markSize = Math.round(SPLASH_SIZE * 0.22);
  const mark = await sharp(SRC_MASKABLE).resize(markSize, markSize).toBuffer();
  return sharp({
    create: { width: SPLASH_SIZE, height: SPLASH_SIZE, channels: 4, background: INK },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    // O fundo já é opaco; sem isto o PNG sai com um canal alpha inteiro de
    // bytes 0xFF — ~40% do arquivo, à toa, dentro do bundle. `removeAlpha` em
    // vez de `flatten` porque o flatten não derruba o canal depois de um
    // composite (verificado: continua saindo RGBA).
    .removeAlpha()
    .png()
    .toBuffer();
}

const appIcon = await buildAppIcon();

// ── Assets nativos (só com o projeto Xcode gerado) ─────────────────────────
if (existsSync(XCASSETS)) {
  write(join(XCASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), appIcon);

  // O template lista o mesmo splash em 1x/2x/3x — a arte é a mesma nos três,
  // como no projeto default. Trocar essa estrutura exigiria reescrever o
  // Contents.json e não traz ganho nenhum.
  const splash = await buildSplash();
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    write(join(XCASSETS, 'Splash.imageset', name), splash);
  }
} else {
  console.warn(
    `[gen-ios-assets] ${XCASSETS.replace(APP_ROOT + '/', '')} não existe — ` +
      'rode `npx cap add ios` num ambiente com Xcode. Gerando só o ícone da loja.',
  );
}

// ── Ícone da ficha da App Store ────────────────────────────────────────────
mkdirSync(OUT_STORE, { recursive: true });
write(join(OUT_STORE, 'app-store-icon-1024.png'), appIcon);

console.log(written.join('\n'));
console.log(`\n${written.length} arquivos gerados.`);
