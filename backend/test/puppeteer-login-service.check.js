'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const PuppeteerLoginService = require('../src/services/puppeteer-login.service')

test('Puppeteer browser detection supports Snap Chromium installations', () => {
  const checkedPaths = []
  const fileSystem = {
    existsSync(filePath) {
      checkedPaths.push(filePath)
      return filePath === '/snap/bin/chromium'
    }
  }

  assert.equal(PuppeteerLoginService.findChromePath(fileSystem), '/snap/bin/chromium')
  assert.ok(checkedPaths.includes('/snap/bin/chromium'))
})

test('Puppeteer browser detection prefers the standard Chrome installation', () => {
  const fileSystem = {
    existsSync(filePath) {
      return filePath === '/usr/bin/google-chrome'
        || filePath === '/snap/bin/chromium'
    }
  }

  assert.equal(PuppeteerLoginService.findChromePath(fileSystem), '/usr/bin/google-chrome')
})
