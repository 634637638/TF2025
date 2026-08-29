const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const analyticsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'routes', 'analytics.js'),
  'utf8'
);
const systemSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'system.js'), 'utf8');
const homeSectionSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'home-section.service.js'), 'utf8');
const marketingSource = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'marketing.ts'), 'utf8');
const inventorySource = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'views', 'inventory', 'InventoryView.vue'), 'utf8');
const profitSource = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'views', 'analytics', 'page', 'ProfitAnalytics.vue'), 'utf8');

const mockRouteMarkers = [
  'mockPerformanceData',
  'performanceRecord',
  "'/pageview'",
  "'/performance/stats'",
  "'/performance/recommendations'"
];

test('analytics has no runtime routes or fixed payloads for simulated metrics', () => {
  for (const marker of mockRouteMarkers) {
    assert.doesNotMatch(analyticsSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `analytics must not retain simulated metric marker: ${marker}`);
  }
});

test('business pages do not fabricate settings, weather, inventory totals or cost categories', () => {
  assert.doesNotMatch(systemSource, /腾飞数码|tf2025\.com|400-123-4567|北京市朝阳区/);
  assert.doesNotMatch(marketingSource, /return ['"]天气正常['"]|return normalized \|\| ['"]天气不错['"]/);
  assert.doesNotMatch(inventorySource, /fallbackStatsCalculation|inventory\.value\.filter\(item => item\.is_new/);
  assert.doesNotMatch(profitSource, /totalCost \* 0\.95|otherCosts \* 0\.05/);
});

test('home recommendations only return explicitly configured products', () => {
  assert.doesNotMatch(homeSectionSource, /ORDER BY RAND\(\)|fill_count|auto_fill|random/i);
  assert.match(homeSectionSource, /products\.slice\(0, normalizedProductLimit\)/);
});
