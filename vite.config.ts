import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Injeta no `dist/sw.js` a lista de assets emitidos e uma versão derivada do
 * conteúdo do bundle.
 *
 * Existe porque os assets do Vite têm nome hasheado: o service worker escrito à
 * mão não tinha como conhecê-los, cacheava só o index.html e, offline, o app
 * abria em tela branca (o HTML vinha do cache, os `/assets/*.js` não).
 *
 * A versão muda quando qualquer arquivo do bundle muda; é ela que nomeia o
 * cache e dispara o aviso de "nova versão" na página.
 *
 * Roda em `closeBundle` porque a cópia do `public/` acontece depois do
 * `generateBundle` — escrever antes seria sobrescrito pelo template.
 */
function pwaPrecache(): Plugin {
  let outDir = 'dist'
  let shell: string[] = []
  let fingerprint = ''

  return {
    name: 's2core-pwa-precache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    generateBundle(_options, bundle) {
      // Precache só o SHELL: entry + os chunks que ele importa estaticamente +
      // o CSS deles. Precachear o bundle inteiro faria a instalação baixar ~2 MB
      // e jogaria fora o ganho do code splitting (a primeira carga é 179 KB).
      // O resto entra no cache sob demanda, na primeira vez que for usado.
      const files = new Set<string>()
      const visit = (name: string) => {
        const chunk = bundle[name]
        if (!chunk || chunk.type !== 'chunk' || files.has(name)) return
        files.add(name)
        chunk.viteMetadata?.importedCss?.forEach((css) => files.add(css))
        chunk.imports.forEach(visit)
      }
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) visit(name)
      }

      shell = [...files].map((f) => `/${f}`)
      // A versão olha o bundle INTEIRO: qualquer arquivo que muda invalida o
      // cache e dispara o aviso de nova versão, mesmo fora do shell.
      fingerprint = Object.keys(bundle).sort().join('|')
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      let sw: string
      try {
        sw = readFileSync(swPath, 'utf8')
      } catch {
        return // sem sw.js no output (ex.: build de biblioteca) — nada a fazer
      }

      const urls = ['/', '/index.html', '/manifest.webmanifest', ...shell]
      const version = createHash('sha256').update(fingerprint).digest('hex').slice(0, 12)

      const injected = [
        '// build:precache-start',
        `const SW_VERSION = '${version}';`,
        `const PRECACHE_URLS = ${JSON.stringify(urls)};`,
        '// build:precache-end',
      ].join('\n')

      const replaced = sw.replace(
        /\/\/ build:precache-start[\s\S]*?\/\/ build:precache-end/,
        injected,
      )
      if (replaced === sw) {
        // Falha silenciosa aqui significaria app offline quebrado em produção.
        throw new Error('pwaPrecache: marcadores build:precache-* não encontrados em public/sw.js')
      }
      writeFileSync(swPath, replaced)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pwaPrecache()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as bibliotecas pesadas do código da aplicação. Duas razões:
        //
        // 1. São usadas em poucas telas — `recharts` só nos gráficos da
        //    Evolução/metabolismo, `leaflet` só no Tracker. Em chunk próprio,
        //    elas entram junto com a rota que as importa (via React.lazy) e não
        //    no primeiro paint de quem abre o /login.
        // 2. Vendor muda muito menos que o app. Em chunk separado, um deploy de
        //    feature deixa de invalidar o cache do React inteiro no navegador.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-motion': ['framer-motion'],
          'vendor-sentry': ['@sentry/react'],
        },
      },
    },
  },
})
