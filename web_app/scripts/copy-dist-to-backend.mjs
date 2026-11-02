import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The Go binary embeds this copy of the build so the API host serves the app
 * itself instead of a landing page. Embedding needs the files to exist before
 * `go build`, which is why they are copied rather than read from web_app.
 */
const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', 'dist');
const target = join(here, '..', '..', 'backend', 'webapp', 'dist');

if (!existsSync(join(source, 'index.html'))) {
  console.error('web_app/dist/index.html is missing - run `npm run build` first.');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`copied ${source} -> ${target}`);
