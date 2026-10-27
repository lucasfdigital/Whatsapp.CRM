// Copies the pinned wa-js build into public/ so WXT ships it (MV3 forbids remote code).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
mkdirSync('public', { recursive: true });
copyFileSync(require.resolve('@wppconnect/wa-js'), 'public/wppconnect-wa.js');
console.log('wa-js copiado para public/wppconnect-wa.js');
