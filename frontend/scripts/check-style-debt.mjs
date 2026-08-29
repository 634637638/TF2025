#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve(new URL('..', import.meta.url).pathname, 'src');
const sourceExtensions = new Set(['.vue', '.css', '.scss']);
const nonRuntimeBackupPattern = /(?:\s+copy|\.bak|\.backup)\.(?:vue|css|scss)$/i;
const baselinePath = path.resolve(new URL('.', import.meta.url).pathname, 'style-debt-baseline.json');
const importantAllowlistPath = path.resolve(new URL('.', import.meta.url).pathname, 'style-important-allowlist.json');

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return null;
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function readImportantAllowlist() {
  const parsed = JSON.parse(fs.readFileSync(importantAllowlistPath, 'utf8'));
  const entries = new Map();
  for (const entry of parsed.files || []) {
    if (!entry.file || !Number.isInteger(entry.max) || entry.max < 0 || !entry.reason) {
      throw new Error(`Invalid !important allowlist entry: ${JSON.stringify(entry)}`);
    }
    entries.set(entry.file, entry);
  }
  return entries;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function collectFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(filePath));
    else if (
      sourceExtensions.has(path.extname(entry.name)) &&
      !nonRuntimeBackupPattern.test(entry.name)
    ) files.push(filePath);
  }
  return files;
}

function styleBlocks(filePath, source) {
  if (path.extname(filePath) !== '.vue') return [{ content: source, scoped: false }];
  return [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)].map(match => ({
    content: match[2],
    scoped: /\bscoped\b/i.test(match[1]),
  }));
}

const totals = { important: 0, colors: 0, colorUsages: 0, scopedImportant: 0, globalImportant: 0 };
const byFile = [];
const importantAllowlist = readImportantAllowlist();

for (const filePath of collectFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8');
  let important = 0;
  let colors = 0;
  let colorUsages = 0;
  let scopedImportant = 0;
  let globalImportant = 0;

  for (const block of styleBlocks(filePath, source)) {
    for (const line of stripComments(block.content).split('\n')) {
      const isTokenDeclaration = /^\s*--[a-z0-9_-]+\s*:/.test(line);
      const lineImportant = (line.match(/!important\b/g) || []).length;
      important += lineImportant;
      if (block.scoped) scopedImportant += lineImportant;
      else globalImportant += lineImportant;
      const matches = line.match(/#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})(?![a-z0-9_-])/gi) || [];
      colors += matches.length;
      if (!isTokenDeclaration) colorUsages += matches.length;
    }
  }

  totals.important += important;
  totals.colors += colors;
  totals.colorUsages += colorUsages;
  totals.scopedImportant += scopedImportant;
  totals.globalImportant += globalImportant;
  if (important || colorUsages) {
    byFile.push({ file: path.relative(path.resolve(sourceRoot, '..'), filePath), important, colorUsages });
  }
}

byFile.sort((left, right) => (right.important + right.colorUsages) - (left.important + left.colorUsages));
let approvedImportant = 0;
const unapprovedByFile = [];
for (const item of byFile) {
  const entry = importantAllowlist.get(item.file);
  const approvedForFile = entry ? Math.min(item.important, entry.max) : 0;
  approvedImportant += approvedForFile;
  const unapprovedForFile = item.important - approvedForFile;
  if (unapprovedForFile > 0) {
    unapprovedByFile.push({ file: item.file, important: unapprovedForFile });
  }
}
const unapprovedImportant = totals.important - approvedImportant;
const importantCounts = new Map(byFile.map(item => [item.file, item.important]));
const allowlistDrift = [];
for (const [file, entry] of importantAllowlist) {
  const actual = importantCounts.get(file) || 0;
  if (actual !== entry.max) {
    allowlistDrift.push(`${file}: 实际 ${actual}，登记 ${entry.max}`);
  }
}
console.log(`样式债务审计：${totals.important} 处 !important，${totals.colors} 处颜色字面量。`);
console.log(`!important 分布：scoped=${totals.scopedImportant}，global/共享=${totals.globalImportant}。`);
console.log(`!important 分类：已登记框架覆盖=${approvedImportant}，未批准债务=${unapprovedImportant}。`);
console.log(`排除 CSS 令牌声明后，仍有 ${totals.colorUsages} 处颜色使用点需要逐步收敛。`);
console.log('高占用文件：');
for (const item of byFile.slice(0, 20)) {
  console.log(`- ${item.file}: !important=${item.important}, colors=${item.colorUsages}`);
}
console.log('未批准 !important 高占用文件：');
for (const item of unapprovedByFile.sort((left, right) => right.important - left.important).slice(0, 20)) {
  console.log(`- ${item.file}: ${item.important}`);
}
if (allowlistDrift.length > 0) {
  console.error(`!important 白名单数量与源码不一致，共 ${allowlistDrift.length} 处：`);
  for (const finding of allowlistDrift) console.error(`- ${finding}`);
  process.exitCode = 1;
}

const baseline = readBaseline();
if (baseline) {
  const regressions = [];
  if (totals.important > baseline.max_important) {
    regressions.push(`!important ${totals.important} > ${baseline.max_important}`);
  }
  if (unapprovedImportant > baseline.max_unapproved_important) {
    regressions.push(`未批准 !important ${unapprovedImportant} > ${baseline.max_unapproved_important}`);
  }
  if (totals.colorUsages > baseline.max_non_token_color_usages) {
    regressions.push(`非令牌颜色使用点 ${totals.colorUsages} > ${baseline.max_non_token_color_usages}`);
  }
  if (regressions.length > 0) {
    console.error(`样式债务超过基线：${regressions.join('；')}`);
    process.exitCode = 1;
  } else {
    console.log(`样式债务基线守护通过：!important <= ${baseline.max_important}，未批准 !important <= ${baseline.max_unapproved_important}，非令牌颜色使用点 <= ${baseline.max_non_token_color_usages}。`);
  }
}
