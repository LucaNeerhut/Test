import { build, normalizePath } from 'vite';
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'exports');
const temporary = await mkdtemp(path.join(tmpdir(), 'gather-portable-'));
const mediaTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };

// Two standard ZIP entries, built with Node alone so packaging needs no extra tools.
function zipFiles(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [filename, data] of entries) {
    const name = Buffer.from(filename);
    const contents = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const compressed = deflateRawSync(contents);
    const checksum = crc32(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(contents.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10); central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(contents.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    localParts.push(local, name, compressed); centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

try {
  const photos = {};
  for (const file of await readdir(path.join(root, 'public/photos'))) {
    const type = mediaTypes[path.extname(file).toLowerCase()];
    if (type) photos[file] = `data:${type};base64,${(await readFile(path.join(root, 'public/photos', file))).toString('base64')}`;
  }
  const seedPath = normalizePath(path.join(root, 'src/lib/seed.ts'));
  let transformedSeed = false;
  await build({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    base: './',
    publicDir: false,
    plugins: [{
      name: 'gather-portable-photos',
      enforce: 'pre',
      transform(source, id) {
        if (normalizePath(id.split('?')[0]) !== seedPath) return null;
        const helper = /^const image = \(id: string, _width = 1400\) => .*$/m;
        if (!helper.test(source)) throw new Error('The seed image helper changed. Update the portable transform before building.');
        transformedSeed = true;
        return `const portablePhotos: Record<string, string> = ${JSON.stringify(photos)};\n${source.replace(helper, "const image = (id: string, _width = 1400) => portablePhotos[images[id] || 'lake.jpg']")}`;
      },
    }],
    build: {
      outDir: temporary,
      emptyOutDir: true,
      assetsInlineLimit: Infinity,
      cssCodeSplit: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  if (!transformedSeed) throw new Error('Portable photo embedding did not run.');
  let html = await readFile(path.join(temporary, 'index.html'), 'utf8');
  const assetPath = source => {
    const resolved = path.resolve(temporary, source.replace(/^\.\//, ''));
    if (!resolved.startsWith(`${temporary}${path.sep}`)) throw new Error(`Unexpected external asset: ${source}`);
    return resolved;
  };
  for (const match of [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]) {
    const javascript = await readFile(assetPath(match[1]), 'utf8');
    html = html.replace(match[0], () => `<script type="module">${javascript.replace(/<\/script/gi, '<\\/script')}</script>`);
  }
  for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)]) {
    const css = await readFile(assetPath(match[1]), 'utf8');
    html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  }
  const favicon = `data:image/svg+xml;base64,${(await readFile(path.join(root, 'public/favicon.svg'))).toString('base64')}`;
  html = html.replace(/href="(?:\.\/|\/)favicon\.svg"/, `href="${favicon}"`);
  const externalAsset = html.match(/(?:src|href)="(?:\.\/|\/)?assets\/[^\s"<>]*/)?.[0] ?? html.match(/(?:src|href)="https?:\/\/[^\s"<>]*/)?.[0];
  if (externalAsset) {
    throw new Error(`Portable HTML still contains a remote or separate bundled asset: ${externalAsset}`);
  }
  await mkdir(output, { recursive: true });
  const artifact = path.join(output, 'Gather.html');
  await writeFile(artifact, html);
  const instructions = `GATHER — A LITTLE CLOSER\n\n1. Extract this ZIP first.\n2. Double-click Gather.html, or right-click it and choose Open with Chrome or Edge.\n3. Browse the sample albums, add your own photos, and make a yearbook.\n\nNo installation, server, account, deployment, or internet connection is needed.\nAll fonts and sample photos are included.\n\nYour albums are saved in this browser on this device. Use the same browser and\nkeep the HTML file in the same location. Clearing browser data can delete your\nalbums. Export a yearbook to keep a separate copy of its selected highlights.\n\nThis is a working local preview. Sample people are fictional; real invitations,\naccounts, online sharing, and cross-device sync are not included yet. Audience\nsettings control previews and yearbook exports. Anyone who receives an exported\nyearbook can see all the photos included in that file.\n\nIf your default browser restricts file storage, open Gather.html in Chrome/Edge.\n`;
  const archive = path.join(output, 'Gather.zip');
  await writeFile(archive, zipFiles([['Gather.html', html], ['OPEN-ME.txt', instructions]]));
  console.log(`Portable app: ${artifact} (${(await stat(artifact)).size.toLocaleString()} bytes)`);
  console.log(`Download ZIP: ${archive} (${(await stat(archive)).size.toLocaleString()} bytes)`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
