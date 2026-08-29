const fs = require('fs').promises
const path = require('path')

const IMAGE_EXTENSIONS_BY_SIGNATURE = {
  '.jpg': new Set(['.jpg', '.jpeg']),
  '.png': new Set(['.png']),
  '.gif': new Set(['.gif']),
  '.webp': new Set(['.webp']),
  '.ico': new Set(['.ico'])
}
const VIDEO_EXTENSIONS_BY_SIGNATURE = {
  '.mp4': new Set(['.mp4', '.mov']),
  '.webm': new Set(['.webm']),
  '.ogg': new Set(['.ogg'])
}

const startsWith = (buffer, bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte)
const asciiAt = (buffer, value, offset = 0) => buffer.subarray(offset, offset + value.length).toString('ascii') === value

function detectUploadKind(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { kind: 'image', extension: '.jpg' }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', extension: '.png' }
  if (asciiAt(buffer, 'GIF87a') || asciiAt(buffer, 'GIF89a')) return { kind: 'image', extension: '.gif' }
  if (asciiAt(buffer, 'RIFF') && asciiAt(buffer, 'WEBP', 8)) return { kind: 'image', extension: '.webp' }
  if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) return { kind: 'image', extension: '.ico' }
  if (asciiAt(buffer, '%PDF-')) return { kind: 'pdf', extension: '.pdf' }
  if (asciiAt(buffer, 'ftyp', 4)) return { kind: 'video', extension: '.mp4' }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', extension: '.webm' }
  if (asciiAt(buffer, 'OggS')) return { kind: 'video', extension: '.ogg' }
  return null
}

async function validateUploadedFileSignature(file, allowedKinds = ['image']) {
  if (!file?.path) return false
  const handle = await fs.open(file.path, 'r')
  try {
    const buffer = Buffer.alloc(32)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const detected = detectUploadKind(buffer.subarray(0, bytesRead))
    if (!detected || !allowedKinds.includes(detected.kind)) return false

    const declaredExtension = path.extname(file.originalname || '').toLowerCase()
    if (detected.kind === 'image') return IMAGE_EXTENSIONS_BY_SIGNATURE[detected.extension]?.has(declaredExtension) === true
    if (detected.kind === 'video') return VIDEO_EXTENSIONS_BY_SIGNATURE[detected.extension]?.has(declaredExtension) === true
    return declaredExtension === detected.extension
  } finally {
    await handle.close()
  }
}

async function removeUploadedFiles(files = []) {
  await Promise.all(files.map(async file => {
    if (!file?.path) return
    try {
      await fs.unlink(file.path)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }))
}

module.exports = {
  validateUploadedFileSignature,
  removeUploadedFiles
}
