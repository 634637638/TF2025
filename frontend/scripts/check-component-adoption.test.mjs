import test from 'node:test'
import assert from 'node:assert/strict'
import { hasValidScannerContext } from './lib/scanner-context.mjs'

test('手机扫码必须绑定品牌上下文，配件序列号必须显式指定序列号档位', () => {
  assert.equal(hasValidScannerContext('<OptimizedScanner :phone="phone" scan-type="serial" />'), true)
  assert.equal(hasValidScannerContext('<OptimizedScanner scan-type="imei" />'), false)
  assert.equal(hasValidScannerContext('<OptimizedScanner scan-type="serial" />'), false)
  assert.equal(hasValidScannerContext('<OptimizedScanner serial-profile="accessory" scan-type="serial" />'), true)
  assert.equal(hasValidScannerContext("<OptimizedScanner scan-type='serial' serial-profile='accessory' />"), true)
  assert.equal(hasValidScannerContext('<OptimizedScanner serial-profile="accessory" scan-type="imei" />'), false)
  assert.equal(hasValidScannerContext('<OptimizedScanner serial-profile="accessory" />'), false)
  assert.equal(hasValidScannerContext('<OptimizedScanner serial-profile="unknown" />'), false)
  assert.equal(hasValidScannerContext('<OptimizedScanner :serial-profile="accessory" :scan-type="serial" />'), false)
})
