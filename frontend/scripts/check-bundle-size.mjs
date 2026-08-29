import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendDir = resolve(scriptDir, '..')
const distDir = join(frontendDir, 'dist')
const indexPath = join(distDir, 'index.html')
const baselinePath = join(scriptDir, 'bundle-size-baseline.json')

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`

const normalizeAssetPath = (value) => {
  const cleanPath = decodeURIComponent(value.split(/[?#]/, 1)[0]).replace(/^\/+/, '')
  return resolve(distDir, cleanPath)
}

const collectInitialAssetUrls = (html) => {
  const urls = new Set()
  const tagPattern = /<(script|link)\b[^>]*>/gi

  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0]
    const isModuleScript = /^<script\b/i.test(tag) && /\btype=["']module["']/i.test(tag)
    const isInitialLink = /^<link\b/i.test(tag) && /\brel=["'](?:modulepreload|stylesheet)["']/i.test(tag)

    if (!isModuleScript && !isInitialLink) continue

    const urlMatch = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)
    if (!urlMatch || /^(?:https?:)?\/\//i.test(urlMatch[1])) continue
    urls.add(urlMatch[1])
  }

  return [...urls]
}

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(entryPath))
    else if (entry.isFile()) files.push(entryPath)
  }

  return files
}

const fail = (messages) => {
  console.error('\nBundle size check failed:')
  for (const message of messages) console.error(`- ${message}`)
  process.exitCode = 1
}

try {
  const [html, baselineText] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(baselinePath, 'utf8'),
  ])
  const baseline = JSON.parse(baselineText)
  const initialUrls = collectInitialAssetUrls(html)
  const initialAssets = await Promise.all(initialUrls.map(async (url) => {
    const filePath = normalizeAssetPath(url)
    const fileStat = await stat(filePath)
    return { url, filePath, size: fileStat.size, extension: extname(filePath).toLowerCase() }
  }))

  const initialJsBytes = initialAssets
    .filter(({ extension }) => extension === '.js')
    .reduce((total, { size }) => total + size, 0)
  const initialCssBytes = initialAssets
    .filter(({ extension }) => extension === '.css')
    .reduce((total, { size }) => total + size, 0)
  const initialTotalBytes = initialJsBytes + initialCssBytes
  const initialPaths = new Set(initialAssets.map(({ filePath }) => filePath))

  const allFiles = await listFiles(distDir)
  const lazyJsFiles = (await Promise.all(
    allFiles
      .filter((filePath) => extname(filePath).toLowerCase() === '.js' && !initialPaths.has(filePath))
      .map(async (filePath) => ({ filePath, size: (await stat(filePath)).size })),
  )).sort((left, right) => right.size - left.size)

  console.log('Initial local assets:')
  for (const asset of initialAssets.sort((left, right) => right.size - left.size)) {
    console.log(`- ${asset.url}: ${formatBytes(asset.size)}`)
  }
  console.log(`Initial JS: ${formatBytes(initialJsBytes)} / ${formatBytes(baseline.maxInitialJsBytes)}`)
  console.log(`Initial CSS: ${formatBytes(initialCssBytes)} / ${formatBytes(baseline.maxInitialCssBytes)}`)
  console.log(`Initial total: ${formatBytes(initialTotalBytes)} / ${formatBytes(baseline.maxInitialTotalBytes)}`)

  console.log('\nLargest lazy JavaScript assets:')
  for (const asset of lazyJsFiles.slice(0, 10)) {
    console.log(`- ${basename(asset.filePath)}: ${formatBytes(asset.size)}`)
  }

  const violations = []
  if (initialJsBytes > baseline.maxInitialJsBytes) {
    violations.push(`initial JS is ${formatBytes(initialJsBytes)}, limit is ${formatBytes(baseline.maxInitialJsBytes)}`)
  }
  if (initialCssBytes > baseline.maxInitialCssBytes) {
    violations.push(`initial CSS is ${formatBytes(initialCssBytes)}, limit is ${formatBytes(baseline.maxInitialCssBytes)}`)
  }
  if (initialTotalBytes > baseline.maxInitialTotalBytes) {
    violations.push(`initial total is ${formatBytes(initialTotalBytes)}, limit is ${formatBytes(baseline.maxInitialTotalBytes)}`)
  }

  const forbiddenPatterns = baseline.forbiddenInitialAssetPatterns.map((pattern) => pattern.toLowerCase())
  for (const asset of initialAssets) {
    const lowerUrl = asset.url.toLowerCase()
    const matchedPattern = forbiddenPatterns.find((pattern) => lowerUrl.includes(pattern))
    if (matchedPattern) violations.push(`${asset.url} brings ${matchedPattern} into the initial page`)
  }

  const oversizedLazyAssets = lazyJsFiles.filter(({ size }) => size > baseline.maxSingleLazyJsBytes)
  for (const asset of oversizedLazyAssets) {
    violations.push(`${basename(asset.filePath)} is ${formatBytes(asset.size)}, lazy JS limit is ${formatBytes(baseline.maxSingleLazyJsBytes)}`)
  }

  if (violations.length > 0) fail(violations)
  else console.log('\nBundle size check passed.')
} catch (error) {
  fail([error instanceof Error ? error.message : String(error)])
}
