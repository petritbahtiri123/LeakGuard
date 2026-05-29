import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "dist", "node_modules"]);
const ignoredPathParts = [
  `${path.sep}ai${path.sep}.venv${path.sep}`,
  `${path.sep}ai${path.sep}models${path.sep}`
];

function shouldIgnore(fullPath) {
  if (ignoredPathParts.some((part) => fullPath.includes(part))) return true;
  return fullPath.split(path.sep).some((part) => ignoredDirs.has(part));
}

function walkMarkdownFiles(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(fullPath)) continue;
    if (entry.isDirectory()) {
      walkMarkdownFiles(fullPath, output);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      output.push(fullPath);
    }
  }
  return output;
}

function stripCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function slugifyHeading(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[<>]/g, "")
    .replace(/&amp;/g, "and")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function collectAnchors(markdown) {
  const anchors = new Set();
  const used = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const base = slugifyHeading(match[2]);
    if (!base) continue;
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function isExternalLink(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target);
}

function normalizeMarkdownTarget(rawTarget) {
  let target = String(rawTarget || "").trim();
  if (!target) return target;
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  }
  return target.replace(/\\ /g, " ");
}

function splitTarget(target) {
  const hashIndex = target.indexOf("#");
  if (hashIndex === -1) return { filePart: target, anchor: "" };
  return {
    filePart: target.slice(0, hashIndex),
    anchor: decodeURIComponent(target.slice(hashIndex + 1)).toLowerCase()
  };
}

function findLinks(markdown) {
  const stripped = stripCodeFences(markdown);
  const links = [];
  const patterns = [
    /!?\[[^\]\n]*\]\(([^)\n]+)\)/g,
    /<((?:\.\.?\/|[A-Za-z]:[\\/])[^>\n]+)>/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(stripped))) {
      const raw = match[1].split(/\s+(?=(?:"[^"]*"|'[^']*')$)/)[0];
      const target = normalizeMarkdownTarget(raw);
      if (target && !isExternalLink(target)) links.push(target);
    }
  }

  return links;
}

const markdownFiles = walkMarkdownFiles(repoRoot);
const anchorsByFile = new Map();
const failures = [];

for (const file of markdownFiles) {
  const markdown = fs.readFileSync(file, "utf8");
  anchorsByFile.set(path.resolve(file), collectAnchors(markdown));
}

for (const file of markdownFiles) {
  const markdown = fs.readFileSync(file, "utf8");
  const links = findLinks(markdown);

  for (const link of links) {
    const { filePart, anchor } = splitTarget(link);
    const targetFile = filePart
      ? path.resolve(path.dirname(file), filePart)
      : path.resolve(file);

    if (!fs.existsSync(targetFile)) {
      failures.push(`${path.relative(repoRoot, file)} -> ${link} (missing target)`);
      continue;
    }

    if (anchor) {
      const stats = fs.statSync(targetFile);
      if (!stats.isFile() || !targetFile.toLowerCase().endsWith(".md")) continue;
      const anchors = anchorsByFile.get(targetFile) || new Set();
      if (!anchors.has(anchor)) {
        failures.push(`${path.relative(repoRoot, file)} -> ${link} (missing anchor #${anchor})`);
      }
    }
  }
}

if (failures.length) {
  console.error("Broken markdown links found:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} markdown files. No broken local links found.`);
