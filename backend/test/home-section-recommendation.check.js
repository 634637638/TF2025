const test = require('node:test')
const assert = require('node:assert/strict')
const homeSectionService = require('../src/services/home-section.service')

test('used_phones recommends configured work phones without including quality phones', () => {
  assert.equal(
    homeSectionService.resolveAutomaticSectionCondition({ section_key: 'used_phones' }),
    "AND h5.condition_grade = '工作机' AND COALESCE(p.quality_grade, '') <> 'A'"
  )
})

test('quality_used recommends 靓机 and A-grade phones', () => {
  assert.equal(
    homeSectionService.resolveAutomaticSectionCondition({ section_key: 'quality_used' }),
    "AND (h5.condition_grade = '靓机' OR p.quality_grade = 'A')"
  )
})

test('unrelated home sections do not auto-recommend used phones', () => {
  assert.equal(
    homeSectionService.resolveAutomaticSectionCondition({ section_key: 'hot_recommend' }),
    null
  )
})
