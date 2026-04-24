import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const iconsDir = path.join(rootDir, 'icons');
const masterSvgPath = path.join(iconsDir, 'icon.svg');

const sizes = [16, 32, 48, 128];
const badgeVariants = {
  safe: '#16A34A',
  warning: '#F59E0B',
  blocked: '#DC2626',
};

async function renderPng(svg, outputPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain' })
    .png()
    .toFile(outputPath);
}

function createBadgeSvg(backgroundColor) {
  return `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="64" cy="64" r="60" fill="${backgroundColor}"/>
  <path d="M64 28C53 39 41 44 27 45V60C27 79 39 95 61 107L64 109L67 107C89 95 101 79 101 60V45C87 44 75 39 64 28Z" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="33" cy="58" r="5.5"/>
    <circle cx="33" cy="78" r="5.5"/>
    <path d="M38.5 58H50L58 64H75"/>
    <path d="M38.5 78H50L58 72H75"/>
    <circle cx="80" cy="68" r="6.5" fill="${backgroundColor}"/>
    <path d="M80 61V52"/>
    <path d="M80 75V84"/>
  </g>
  <g fill="white">
    <circle cx="80" cy="52" r="3"/>
    <circle cx="80" cy="84" r="3"/>
  </g>
</svg>`;
}

async function main() {
  await fs.mkdir(iconsDir, { recursive: true });
  const masterSvg = await fs.readFile(masterSvgPath, 'utf8');

  await Promise.all(
    sizes.map((size) =>
      renderPng(masterSvg, path.join(iconsDir, `icon${size}.png`), size),
    ),
  );

  await Promise.all(
    Object.entries(badgeVariants).map(([name, color]) =>
      renderPng(createBadgeSvg(color), path.join(iconsDir, `${name}.png`), 128),
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
