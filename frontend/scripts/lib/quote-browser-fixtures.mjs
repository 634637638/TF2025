import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileTemplate, parse } from '@vue/compiler-sfc'

// 从真实页面模板提取公共页头和保存弹窗，隔离业务请求。两个浏览器入口共用。
export function createQuoteFixtureModules(root) {
  const quoteSaveModules = new Map()
  const quoteHeaderModules = new Map()
  for (const [kind, file] of [['wholesale', 'PublicPriceQuery.vue'], ['sales', 'SalesPriceDisplay.vue']]) {
    const filename = join(root, 'src/views/price-list/page', file)
    const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
    const header = descriptor.template.ast.children.find(node => node.type === 1)?.children.find(node => node.type === 1 && node.tag === 'PublicPriceHeader')
    assert.ok(header, `${file} 缺少公共报价页头`)
    const headerTemplate = compileTemplate({ source: header.loc.source, filename, id: `quote-header-${kind}` })
    assert.deepEqual(headerTemplate.errors, [], `${file} 页头编译失败`)
    quoteHeaderModules.set(`\0quote-header-${kind}`, `${headerTemplate.code}
  import { reactive, computed } from 'vue';
  import { useMobile } from '/src/composables/mobile.ts';
  export default { render, setup() {
    const { isMobile } = useMobile();
    const fixture = reactive({ passwordVerified:false, verifiedUserName:'测试用户', searchKeyword:'',
      siteSettingsStore:{settings:{siteName:'测试报价'}}, loading:false, searchSubmitting:false,
      isGenerating:false, usedModelsLoading:false, showInStockOnly:false, showUsedPhonesOnly:false,
      allResults:[{}], displayedRows:[{}], searchResults:[{}], showNoticeDialog:false,
      handleSearchInput(){}, handleSearch(){}, handleClear(){}, downloadAsImage(){},
      toggleInStockFilter(){ fixture.showInStockOnly = !fixture.showInStockOnly; },
      toggleUsedPhonesFilter(){ fixture.showUsedPhonesOnly = !fixture.showUsedPhonesOnly; }
    });
    window.updatePriceHeader = values => Object.assign(fixture, values);
    window.priceHeaderState = () => ({ showInStockOnly:fixture.showInStockOnly, showUsedPhonesOnly:fixture.showUsedPhonesOnly });
    return { ...Object.fromEntries(Object.keys(fixture).map(key => [key, computed({get:()=>fixture[key],set:value=>fixture[key]=value})])), isMobile };
  } };`)
    const dialog = descriptor.template.ast.children.find(node => node.type === 1)?.children.find(node =>
      node.type === 1 && node.tag === 'MobileDialog' && node.props.some(prop => prop.type === 6 && prop.name === 'dialog-class' && prop.value?.content === 'ios-image-dialog'))
    assert.ok(dialog, `${file} 缺少公共图片保存弹窗`)
    const template = compileTemplate({ source: dialog.loc.source, filename, id: `quote-save-${kind}` })
    assert.deepEqual(template.errors, [], `${file} 保存弹窗编译失败`)
    quoteSaveModules.set(`\0quote-save-${kind}`, `${template.code}
  import { ref } from 'vue';
  export default { render, setup() {
    const showIOSImageModal = ref(true);
    return { showIOSImageModal, iosImageUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="1200"><rect width="300" height="1200" fill="white"/></svg>'),
      siteSettingsStore: { settings: { siteName: '测试报价' } }, isSharingImage: false,
      toggleIOSImageMode() {}, shareIOSImage() {}, closeIOSImageModal() { showIOSImageModal.value = false; } };
  } };`)
  }
  return { quoteSaveModules, quoteHeaderModules }
}
