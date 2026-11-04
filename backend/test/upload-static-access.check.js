const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const express = require('express')

const {
  inspectUploadRequestPath,
  uploadStaticAccess
} = require('../src/middleware/upload-static-access')

const request = (port, requestPath) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: requestPath }, response => {
    let body = ''
    response.on('data', chunk => { body += chunk })
    response.on('end', () => resolve({ body, status: response.statusCode }))
  }).on('error', reject)
})

test('upload path inspection rejects private roots and parent traversal', () => {
  assert.deepEqual(inspectUploadRequestPath('/public/image.jpg'), {
    hasParentTraversal: false,
    isPrivate: false,
    normalizedPath: 'public/image.jpg'
  })
  assert.equal(inspectUploadRequestPath('/guide/file.pdf').isPrivate, true)
  assert.equal(inspectUploadRequestPath('/public/../guide/file.pdf').hasParentTraversal, true)
  assert.equal(inspectUploadRequestPath('/public/%252e%252e/guide/file.pdf').hasParentTraversal, true)
})

test('static upload middleware cannot traverse from a public directory into a private directory', async t => {
  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-upload-static-'))
  fs.mkdirSync(path.join(uploadRoot, 'public'), { recursive: true })
  fs.mkdirSync(path.join(uploadRoot, 'guide'), { recursive: true })
  fs.writeFileSync(path.join(uploadRoot, 'public', 'audit.txt'), 'public-content')
  fs.writeFileSync(path.join(uploadRoot, 'guide', 'audit.txt'), 'private-content')

  const app = express()
  app.use('/uploads', uploadStaticAccess)
  app.use('/uploads', express.static(uploadRoot))
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })

  t.after(() => {
    server.close()
    fs.rmSync(uploadRoot, { recursive: true, force: true })
  })

  const port = server.address().port
  const publicResult = await request(port, '/uploads/public/audit.txt')
  const privateResult = await request(port, '/uploads/guide/audit.txt')
  const traversalResult = await request(port, '/uploads/public/../guide/audit.txt')
  const encodedTraversalResult = await request(port, '/uploads/public/%2e%2e/guide/audit.txt')
  const doubleEncodedTraversalResult = await request(port, '/uploads/public/%252e%252e/guide/audit.txt')

  assert.equal(publicResult.status, 200)
  assert.equal(publicResult.body, 'public-content')
  assert.equal(privateResult.status, 404)
  assert.equal(traversalResult.status, 404)
  assert.equal(encodedTraversalResult.status, 404)
  assert.equal(doubleEncodedTraversalResult.status, 404)
  assert.doesNotMatch(traversalResult.body, /private-content/)
})
