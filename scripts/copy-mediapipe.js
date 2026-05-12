#!/usr/bin/env node
/**
 * Copies MediaPipe assets from node_modules to public/mediapipe/
 * so they can be served locally instead of from cdn.jsdelivr.net.
 *
 * Run automatically via "prebuild" in package.json.
 */
import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dest = join(root, 'public', 'mediapipe');

const packages = [
  { src: join(root, 'node_modules', '@mediapipe', 'camera_utils'), subdir: 'camera_utils' },
  { src: join(root, 'node_modules', '@mediapipe', 'drawing_utils'), subdir: 'drawing_utils' },
  { src: join(root, 'node_modules', '@mediapipe', 'pose'),          subdir: 'pose' },
];

for (const pkg of packages) {
  const target = join(dest, pkg.subdir);
  mkdirSync(target, { recursive: true });
  cpSync(pkg.src, target, { recursive: true });
  console.log(`[mediapipe] Copied ${pkg.subdir}`);
}

console.log('[mediapipe] Assets copied to public/mediapipe/');
