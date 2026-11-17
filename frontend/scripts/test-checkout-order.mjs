#!/usr/bin/env node
// 隔离整单详情、客户商品历史、手机查询、销售凭证、销售整页、快速出库、结算组件及手机/商品售后；仅内存样本，所有业务网络访问拒绝。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { salesCheckoutEntry, salesPageEntry, quickSaleEntry, createSalesCheckoutMocks, verifySalesCheckout, verifySalesPage, verifyQuickSale } from './lib/sales-checkout-browser-fixture.mjs'
import { phoneReturnEntry, verifyPhoneReturn, goodsExchangeEntry, verifyGoodsExchange } from './lib/sales-aftersale-browser-fixture.mjs'
import { queryGoodsEntry, verifyQueryGoods, verifyQueryGoodsSale, verifyQueryPhone } from './lib/query-goods-browser-fixture.mjs'
import { verifyCustomerGoodsHistory, verifyCustomerFilmHistory } from './lib/customer-record-browser-fixture.mjs'
import { filmServiceEntry, verifyFilmService } from './lib/film-service-browser-fixture.mjs'
import { purchaseReturnEntry, verifyPurchaseReturn } from './lib/accessory-purchase-return-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-checkout-order-'))
const screenshots = process.env.CHECKOUT_SCREENSHOT_DIR ? resolve(process.env.CHECKOUT_SCREENSHOT_DIR) : null
// 默认仍执行完整矩阵；布局修复可明确筛选视口/场景复验。
const viewportArgument = process.argv.find(value => value.startsWith('--viewports='))?.split('=')[1]
const viewportWidths = viewportArgument ? viewportArgument.split(',').map(Number) : [360, 390, 430, 768, 1440]
assert.ok(viewportWidths.length > 0 && viewportWidths.length <= 10 && viewportWidths.every(width => Number.isSafeInteger(width) && width >= 320 && width <= 3840), '视口参数无效')
const scenarioFilter = process.argv.find(value => value.startsWith('--scenario='))?.split('=')[1]
const salesOnly = process.argv.includes('--sales-only')
const salesPage = process.argv.includes('--sales-page-only')
const quickSale = process.argv.includes('--quick-sale-only')
const phoneReturn = process.argv.includes('--phone-return-only')
const goodsExchange = process.argv.includes('--goods-exchange-only')
const goodsSaleOnly = process.argv.includes('--goods-sale-only')
const phoneQueryOnly = process.argv.includes('--phone-query-only')
const goodsPage = process.argv.includes('--goods-page-only') || goodsSaleOnly || phoneQueryOnly
const filmService = process.argv.includes('--film-service-only')
const purchaseReturn = process.argv.includes('--purchase-return-only')
const phoneDetailOnly = process.argv.includes('--phone-detail-only')
const salesMode = purchaseReturn || salesOnly || salesPage || quickSale || phoneReturn || goodsExchange || goodsPage || filmService
const entry = `
import {createApp,h,ref,reactive} from 'vue';
import ElementPlus from 'element-plus';
import MobileDialog from '/src/components/MobileDialog.vue';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import RecordDetailDialog from '/src/components/RecordDetailDialog.vue';
import SectionLoading from '/src/components/SectionLoading.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import Pagination from '/src/components/Pagination.vue';
import {vTFLoading} from '/src/directives/index.ts';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
import {createPinia} from 'pinia';
import {applyDeviceRootClass} from '/src/utils/device-detection.ts';
import {getNumberColumnMinWidth} from '/src/utils/table-layout.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/admin-layout.css';import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';import '/src/styles/components/_dialog-actions.scss';
window.access=reactive({customers:true,query:true,goods:true,create:true,gift:true,film:true,phoneHidden:[],goodsHidden:[]});
window.requests=[];window.fail=false;
const item={id:201,item_type:'accessory',sale_no:'GOODS-ORIGINAL-LONG-000000001',linked_phone_sale_no:'PHONE-ORIGINAL-00000001',sale_type:'sale',
name:'原单通用充电器长名称完整显示',brand_name:'配件品牌',product_model:'MWVW3CH',color_name:'白色',memory:null,imei:null,
serial_numbers:['000SN1234567890'.repeat(4),'000SN0987654321'.repeat(4)],unit:'个',quantity:2,
unit_price:10,gross_amount:20,total_amount:15,points_used:500,deduction_amount:5,points_awarded:0,
gift_return_unit_price:null,gift_return_total:null,gift_agreement_state:null};
window.data={id:10,order_no:'SO-ORIGINAL-LONG-000000001',customer_name:'原客户',customer_phone:'13900000001',store_name:'一店',operator_name:'原销售员',
sale_time:'2026-11-14 10:00:00',remarks:'整批公共备注'.repeat(20),total_amount:120,final_amount:115,paid_amount:115,deduction_amount:5,points_used:500,points_awarded:10,
items:[{...item,id:101,item_type:'phone',sale_no:'PHONE-ORIGINAL-00000001',linked_phone_sale_no:null,name:'原手机型号',product_model:null,
serial_numbers:['000PHONE'],imei:'012345678901234',memory:'128G',unit:'台',quantity:1,unit_price:100,gross_amount:100,total_amount:100,points_used:0,deduction_amount:0,points_awarded:10},
item,{...item,id:202,name:'原赠膜',sale_type:'gift',serial_numbers:[],quantity:1,unit_price:0,gross_amount:0,total_amount:0,points_used:0,deduction_amount:0,
gift_return_unit_price:12.34,gift_return_total:12.34,gift_agreement_state:'recorded'}]};
const {default:Order}=await import('/src/components/query/CheckoutOrderDialog.vue');
const {default:History}=await import('/src/views/customers/page/CustomerGoodsHistory.vue');
const {default:Film}=await import('/src/components/query/FilmServiceDialog.vue');
const {default:Receipt}=await import('/src/components/query/SalesReceipt.vue');
const {default:PhoneDetail}=await import('/src/components/query/QueryDetailDialog.vue');
const phoneDetailMode=location.pathname==='/phone-detail';
window.phoneDetail=reactive({基本信息:{phone_id:11,brand:'手机品牌',model:'原手机型号',is_new:1,status:'已售',status_code:'sold'},
客户信息:{},供应商信息:{},店铺信息:{},价格信息:{},时间信息:{},操作员信息:{},销售信息:{sale_id:81,has_checkout_order:false}});
const historyMode=location.pathname==='/history';
const filmMode=location.pathname==='/film';
const receiptMode=location.pathname==='/receipt';
window.receipt=reactive({number:'RECEIPT-1',status:'sold',items:[{phone_id:11,sale_id:81,brand:'苹果',model:'手机甲',color:'黑色',memory:'128G',
imei:'012345678901234',serialNumber:'',salePrice:100.01,isNew:1}]});
window.receiptGoods=[{id:51,name:'原单通用充电器长名称完整显示',brand_name:'配件品牌',product_model:'MWVW3CH',color_name:'白色',unit:'个',quantity:2,
unit_price:20,total_price:35.02,sale_type:'sale',points_used:498,deduction_amount:4.98,serial_numbers:item.serial_numbers,
gift_return_unit_price:null,gift_return_total:null,gift_agreement_state:null},
{id:52,name:'原赠膜',brand_name:'膜品牌',product_model:'通用',color_name:'透明',unit:'张',quantity:1,unit_price:0,total_price:0,sale_type:'gift',points_used:0,deduction_amount:0,serial_numbers:[],
gift_return_unit_price:12.34,gift_return_total:12.34,gift_agreement_state:'recorded'}];
window.goodsRows=Array.from({length:11},(_,index)=>({id:51+index,sale_no:'AS-LONG-0000000000000000'+index,order_no:'SO1',linked_phone_invoice:'PHONE1',
sale_type:index%2?'gift':'sale',store_name:'原销售门店',name:index===10?'末页商品':'客户原商品长名称完整显示'+index,category:'充电头',brand_name:'原品牌',product_model:'MWVW3CH',color_name:'白',unit:'个',
quantity:2,returned_quantity:2,remaining_quantity:0,unit_price:index%2?0:20,total_price:index%2?0:35,points_awarded:0,points_used:index%2?0:500,deduction_amount:index%2?0:5,
operator_name:'原销售员',sale_time:'2026-11-14 10:00:00',remarks:'原备注'.repeat(25),has_snapshot:1,has_order:true}));
window.filmRows=Array.from({length:21},(_,index)=>({id:index+1,order_id:index+1,order_no:'FILM-LONG-00000000'+index,quantity:2,
store_id:2,store_name:'跨店服务门店长名称完整显示',operator_id:7,operator_name:'办理员',business_time:'2026-11-14 09:00:00',created_at:'2026-11-14 09:01:00',
items:[{name:'跨店贴膜记录'+index,sale_type:'gift',quantity:2,total_amount:0}]}));
window.mockRead=(url,config)=>{if(url.endsWith('/film-services')){const {page,page_size:size}=config.params;return {customer_id:9,eligible_for_free:false,service_count:21,free_count:21,paid_count:0,film_quantity:42,device_service_count:null,device_film_quantity:null,
data:window.filmRows.slice((page-1)*size,page*size),pagination:{page,page_size:size,total:21,total_pages:Math.ceil(21/size),has_next:page*size<21,has_prev:page>1}}}
if(url.endsWith('/accessories'))return structuredClone(url.includes('/82/')?[{...window.receiptGoods[1],id:53,name:'手机乙赠品'}]:window.receiptGoods);if(url.endsWith('/goods')){const {page,page_size:size}=config.params;return {data:window.goodsRows.slice((page-1)*size,page*size),pagination:{page,page_size:size,total:11,total_pages:Math.ceil(11/size),has_next:page<Math.ceil(11/size),has_prev:page>1}}}return structuredClone(window.data)};
applyDeviceRootClass();const open=ref(true);window.reopen=()=>{open.value=true};
const app=createApp({render:()=>phoneDetailMode?h(PhoneDetail,{modelValue:open.value,'onUpdate:modelValue':value=>open.value=value,detailItem:window.phoneDetail,canEdit:false,canDelete:false,canReturnToStock:false}):filmMode?h(Film,{modelValue:open.value,'onUpdate:modelValue':value=>open.value=value,customer:{id:9,name:'原客户',phone:'13900000001'}}):receiptMode?h(Receipt,{visible:open.value,items:window.receipt.items,status:window.receipt.status,receiptNumber:window.receipt.number,
customerName:'原客户',customerPhone:'13900000001',storeName:'原销售店',salesOperator:'原销售员',saleDate:'2026-11-14 10:00:00',onClose:()=>open.value=false}):historyMode?h(MobileDialog,{modelValue:true,title:'客户详情',dialogClass:'crud-dialog-lg',showDefaultFooter:false},()=>h(History,{customerId:8,active:true})):
h(Order,{modelValue:open.value,'onUpdate:modelValue':v=>open.value=v,saleId:51,source:'goods'})});
app.use(createPinia());app.use(ElementPlus);app.component('MobileDialog',MobileDialog);app.component('RecordDescriptions',RecordDescriptions);app.component('RecordDetailDialog',RecordDetailDialog);
app.component('SectionLoading',SectionLoading);app.component('DataEmptyState',DataEmptyState);app.component('Pagination',Pagination);
app.config.globalProperties.$getNumberColumnWidth=getNumberColumnMinWidth;
app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);app.directive('permission',{});app.mount('#app');
`
const mocks = new Map([
  [resolve(root, 'src/utils/unified-api.ts'), 'export const unifiedApi={get:async(url,config)=>{window.requests.push(url);await new Promise(r=>setTimeout(r,30));if(window.fail)throw Error(\'隔离读取失败\');return {success:true,data:window.mockRead(url,config)}}}'],
  [resolve(root, 'src/composables/usePagePermissions.ts'), 'import {computed} from \'vue\';export const usePagePermissions=(module)=>({canView:computed(()=>window.access[module===\'accessories\'?\'goods\':module]),canCreate:computed(()=>window.access.create),hasPermission:action=>action===\'goods-view\'?window.access.goods:window.access[action]})'],
  [resolve(root, 'src/composables/useFieldPermissions.ts'), 'export const fieldPermissions={isFieldVisible:(module,field)=>!window.access[module===\'query_queryview\'?\'phoneHidden\':\'goodsHidden\'].includes(field),getHiddenFields:module=>window.access[module===\'query_queryview\'?\'phoneHidden\':\'goodsHidden\']}'],
  [resolve(root, 'src/stores/siteSettings.ts'), 'export const useSiteSettingsStore=()=>({settings:{siteName:\'隔离凭证\'}})']
])
const salesMocks = createSalesCheckoutMocks(root)
if (purchaseReturn) salesMocks.set(resolve(root, 'src/composables/useFieldPermissions.ts'), `
  import {computed} from 'vue';
  export const fieldPermissions={permissions:computed(()=>window.fixture.hidden),
    isFieldVisible:(_module,field)=>!window.fixture.hidden.includes(field)};
`)

const clickButton = async (page, label) => {
  const button = await page.waitForSelector(`button ::-p-text(${label})`, { visible: true })
  await button.click()
}

const readPrintedReceipt = async page => {
  await page.evaluate(() => { window.printed = false })
  await clickButton(page, '打印')
  await page.waitForFunction(() => window.printed)
  try {
    return await page.evaluate(() => {
      const doc = window.receiptPrint.document
      return { text: doc.body.textContent, tables: doc.querySelectorAll('.receipt-table').length,
        totalsClipped: [...doc.querySelectorAll('.totals-bar strong')].some(element => {
          const rect = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect()
          return rect.left < parent.left - 1 || rect.right > parent.right + 1 || rect.top < parent.top - 1 || rect.bottom > parent.bottom + 1
        }),
        clipped: [...doc.querySelectorAll('.cell-stack')].some(el => el.scrollWidth > el.clientWidth + 2) }
    })
  } finally {
    await page.evaluate(() => window.receiptPrint.close())
    await page.bringToFront()
  }
}

const verifyReceipt = async (page, temporary, errors) => {
  const expected = ['原单通用充电器长名称完整显示', '原赠膜', '购买', '赠品', '原单约定 ¥12.34/件，合计 ¥12.34', '实际扣款以售后核对为准', '498积分', '实收 ¥35.02', '3件配件', '135.03', '000SN1234567890'.repeat(4)]
  await page.waitForFunction(() => {
    // 先完成真实主题过渡，再比较导出前后的颜色，避免把过渡中间值当作最终主题。
    getComputedStyle(document.querySelector('.table-number-badge')).backgroundColor
    return document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect.getComputedTiming().iterations === Infinity)
  })
  const rendered = await page.$eval('[data-receipt-export]', element => ({ text: element.textContent,
    badgeColor: getComputedStyle(element.querySelector('.table-number-badge')).backgroundColor,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    totalsClipped: [...element.querySelectorAll('.totals-bar strong')].some(element => {
      const rect = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect()
      return rect.left < parent.left - 1 || rect.right > parent.right + 1 || rect.top < parent.top - 1 || rect.bottom > parent.bottom + 1
    }),
    clipped: [...element.querySelectorAll('.cell-stack')].filter(cell => cell.scrollWidth > cell.clientWidth + 2).map(cell => cell.textContent) }))
  for (const value of expected) assert.ok(rendered.text.includes(value), value)
  assert.equal(rendered.overflow, false, '凭证页面横向溢出')
  assert.equal(rendered.totalsClipped, false, '合计栏文字超出所属字段')
  assert.deepEqual(rendered.clipped, [], '长名称或SN被截断')
  await page.evaluate(() => {
    const originalOpen = window.open.bind(window)
    window.open = (...args) => { const popup = originalOpen(...args); window.receiptPrint = popup; popup.print = () => { window.printed = true }; return popup }
    window.exports = []; window.revoked = []
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); window.exports.push({ url, blob }); return url }
    URL.revokeObjectURL = url => { window.revoked.push(url); revoke(url) }
  })
  const printed = await readPrintedReceipt(page)
  for (const value of expected) assert.ok(printed.text.includes(value), `打印缺少 ${value}`)
  assert.equal(printed.tables, 2); assert.equal(printed.clipped, false); assert.equal(printed.totalsClipped, false)

  const session = await page.createCDPSession()
  const downloads = await mkdtemp(join(temporary, 'receipt-downloads-'))
  try {
    await session.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
    for (let index = 0; index < 2; index++) {
      await page.evaluate(index => { window.receipt.number = `RECEIPT-${index + 1}` }, index)
      await clickButton(page, '保存图片')
      await page.waitForFunction(count => window.exports.length === count, { timeout: 30000 }, index + 1).catch(async error => {
        const state = await page.evaluate(() => ({ exports: window.exports.length, revoked: window.revoked.length,
          buttons: [...document.querySelectorAll('button')].map(button => ({ text: button.textContent, disabled: button.disabled })) }))
        throw new Error(`凭证PNG未完成：${JSON.stringify({ ...state, errors })}`, { cause: error })
      })
      await new Promise(resolve => setTimeout(resolve, 1200))
      await page.waitForFunction(count => window.revoked.length === count, { timeout: 5000 }, index + 1)
      const image = await page.evaluate(async index => {
        const { blob, url } = window.exports[index], bitmap = await createImageBitmap(blob)
        const result = { type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height,
          linkRemoved: ![...document.querySelectorAll('a')].some(link => link.href === url) }
        bitmap.close(); return result
      }, index)
      assert.equal(image.type, 'image/png'); assert.ok(image.size > 10000); assert.ok(image.width > 1000 && image.height > 500)
      assert.equal(image.linkRemoved, true)
      const download = await readFile(join(downloads, `隔离凭证销售凭证_RECEIPT-${index + 1}.png`))
      assert.equal(download.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); assert.equal(download.length, image.size)
    }
  } finally { await session.detach() }
  assert.equal(await page.$eval('.table-number-badge', element => getComputedStyle(element).backgroundColor), rendered.badgeColor, '导出不可改变原页面主题颜色')
  const conversion = await page.evaluate(async () => {
    const { normalizeCanvasColors } = await import('/src/utils/html2canvas.ts')
    const source = document.createElement('div')
    source.style.color = 'color(srgb 1 0 0 / 0.5)'
    source.style.border = '1px solid color(srgb 0 0 1 / 0.25)'
    document.body.append(source)
    const clone = source.cloneNode(true)
    document.body.append(clone)
    try {
      normalizeCanvasColors(clone)
      return { source: source.style.color, color: getComputedStyle(clone).color, border: getComputedStyle(clone).borderTopColor }
    } finally { source.remove(); clone.remove() }
  })
  assert.equal(conversion.source, 'color(srgb 1 0 0 / 0.5)')
  for (const [color, channels, alpha] of [[conversion.color, '255, 0, 0', 0.5], [conversion.border, '0, 0, 255', 0.25]]) {
    assert.ok(color.startsWith(`rgba(${channels}, `))
    assert.ok(Math.abs(Number(color.slice(color.lastIndexOf(',') + 1, -1)) - alpha) <= 1 / 255, '颜色转换保留透明度')
  }
  await page.evaluate(() => { window.access.goods = false })
  await page.waitForFunction(() => document.body.textContent.includes('本凭证仅含手机') && !document.body.textContent.includes('原赠膜'))
  await page.evaluate(() => { window.fail = true; window.access.goods = true })
  await page.waitForFunction(() => document.body.textContent.includes('随单配件核对失败'))
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].filter(el => ['打印', '保存图片'].includes(el.textContent.trim())).every(el => el.disabled)), true)
  await page.evaluate(() => { window.fail = false })
  await clickButton(page, '重新核对')
  await page.waitForFunction(() => document.body.textContent.includes('原赠膜'))
  for (const status of ['peer_transfer', 'supplier_proxy']) {
    const requests = await page.evaluate(status => { window.receipt.status = status; return window.requests.length }, status)
    await page.waitForFunction(() => !document.body.textContent.includes('原赠膜'))
    assert.equal(await page.evaluate(() => window.requests.length), requests, '批发/划拨不读取零售配件')
    const printed = await readPrintedReceipt(page)
    assert.ok(printed.text.includes(status === 'peer_transfer' ? '批发凭证' : '划拨凭证'))
    assert.equal(printed.tables, 1); assert.equal(printed.clipped, false); assert.equal(printed.totalsClipped, false)
  }
  await page.evaluate(() => {
    window.receipt.items.push({ ...window.receipt.items[0], phone_id: 12, sale_id: 82, model: '手机乙', imei: '112345678901234' })
    window.receipt.status = 'sold'
  })
  await page.waitForFunction(() => document.body.textContent.includes('手机乙赠品') && document.body.textContent.includes('235.04'))
  const combined = await readPrintedReceipt(page)
  for (const value of ['手机甲', '手机乙赠品', '2台', '4件配件', '235.04']) assert.ok(combined.text.includes(value), `合并凭证缺少 ${value}`)
  assert.equal(combined.tables, 2); assert.equal(combined.clipped, false); assert.equal(combined.totalsClipped, false)
}
let server, browser
try {
  if (screenshots) await mkdir(screenshots, { recursive: true })
  server = await createServer({ configFile: false, envFile: false, root, cacheDir: join(temporary, 'vite-cache'), logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: ['vue', 'pinia', 'element-plus', 'lodash.debounce', 'lodash.throttle', 'aos', 'vuedraggable', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    // 隔离验收固定本轮已加载源码，避免其他开发会话的HMR在键鼠步骤中替换DOM。
    resolve: { alias: { '@': resolve(root, 'src') } }, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
    plugins: [{ name: 'isolated-checkout-order', enforce: 'pre',
      resolveId(id) { if (id === '/fixture.js') return '\0checkout-fixture' },
      load(id) { if (id === '\0checkout-fixture') return purchaseReturn ? purchaseReturnEntry : filmService ? filmServiceEntry : goodsPage ? queryGoodsEntry : goodsExchange ? goodsExchangeEntry : phoneReturn ? phoneReturnEntry : quickSale ? quickSaleEntry : salesPage ? salesPageEntry : salesOnly ? salesCheckoutEntry : entry; return (salesMode ? salesMocks : mocks).get(id.split('?')[0]) },
      configureServer(vite) { vite.middlewares.use((req, res, next) => {
        if (['/', '/history', '/film', '/receipt', '/phone-detail'].includes(req.url.split('?')[0])) { res.setHeader('Content-Type', 'text/html'); res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>') }
        else next()
      }) }
    }, vue()] })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: join(temporary, 'chrome') })
  const modes = purchaseReturn ? ['purchase-return'] : filmService ? ['film-service'] : goodsPage ? phoneQueryOnly ? ['phone-query'] : goodsSaleOnly ? ['goods-sale'] : ['goods-query', 'goods-sale'] : goodsExchange ? ['exchange-up', 'exchange-down', 'exchange-gift'] : phoneReturn ? ['phone-refund', 'phone-collection'] : quickSale ? ['quick'] : salesPage ? ['single', 'batch'] : salesMode ? ['single', 'batch', 'goods'] : process.argv.includes('--customer-pages-only') ? ['history', 'film'] : process.argv.includes('--receipt-only') ? ['receipt'] : process.argv.includes('--documents-only') ? ['order', 'receipt'] : ['order', 'history', 'film', 'receipt']
  const selectedModes = phoneDetailOnly ? ['phone-detail'] : scenarioFilter ? modes.filter(mode => mode === scenarioFilter) : modes
  assert.ok(selectedModes.length, '没有匹配的验收场景')
  for (const mode of selectedModes) for (const width of viewportWidths) for (const dark of [false, true]) {
    const history = mode === 'history', film = mode === 'film', receipt = mode === 'receipt'
    const page = await browser.newPage(), errors = [], blocked = []
    await page.setViewport({ width, height: 1000, hasTouch: (goodsPage || history) && width <= 1024 })
    // 公共设备检测同时读取screen与视口；同步仿真屏幕，避免桌面视口被headless默认800px屏幕误判为平板。
    const metrics = await page.createCDPSession()
    await metrics.send('Emulation.setDeviceMetricsOverride', {
      width, height: 1000, screenWidth: width, screenHeight: 1000, deviceScaleFactor: 1, mobile: false
    })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }])
    await page.setRequestInterception(true)
    page.on('request', request => {
      if (request.url().startsWith(origin) && !request.url().startsWith(origin + '/api/') || request.url().startsWith('blob:') || request.url().startsWith('data:')) request.continue()
      else { blocked.push(request.url()); request.abort() }
    })
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      // 本用例主动注入读取失败并验证重试；只接受该条业务日志，其他浏览器错误仍使回归失败。
      if (message.type() === 'error' && !/^\[\d{2}:\d{2}:\d{2}\] \[ERROR\] 核对销售凭证配件失败:: Error: 隔离读取失败$/.test(message.text())) errors.push(message.text())
    })
    const sample = history ? '客户原商品长名称完整显示0' : film ? '跨店贴膜记录0' : '原赠膜'
    const capture = async (stage = '') => {
      if (screenshots && (width === 390 && dark || width === 1440 && !dark)) {
        await page.waitForFunction(() => document.getAnimations().every(animation =>
          animation.playState !== 'running' || animation.effect.getComputedTiming().iterations === Infinity))
        // 弹窗正文独立滚动；只截当前视口，避免整页截图重置Chromium的仿真屏幕尺寸。
        await page.screenshot({ path: join(screenshots, `${mode}-${width}-${dark ? 'dark' : 'light'}${stage ? `-${stage}` : ''}.png`), captureBeyondViewport: false })
        assert.deepEqual(await page.evaluate(() => ({ viewport: innerWidth, screen: screen.width })),
          { viewport: width, screen: width }, '截图不得改变浏览器的响应式测试尺寸')
      }
    }
    await page.goto(origin + (mode === 'phone-detail' ? '/phone-detail' : salesMode ? `/?scenario=${mode}` : receipt ? '/receipt' : history ? '/history' : film ? '/film' : '/'), { timeout: 60000 })
      .catch(error => { throw new Error(`加载 ${mode}/${width}/${dark} 失败：${error.message}；浏览器错误：${errors.join(' | ')}`, { cause: error }) })
    assert.deepEqual(await page.evaluate(() => ({ viewport: innerWidth, screen: screen.width })),
      { viewport: width, screen: width }, '浏览器视口与仿真屏幕必须使用同一测试尺寸')
    if (mode === 'phone-detail') {
      await page.evaluate(dark => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, dark)
      await page.waitForFunction(() => document.body.textContent.includes('设备销售信息'))
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '整单明细')), false)
      assert.deepEqual(await page.evaluate(() => window.requests), [])
      await page.evaluate(() => { window.phoneDetail.销售信息.has_checkout_order = true })
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '整单明细'))
      await clickButton(page, '整单明细')
      await page.waitForFunction(() => document.body.textContent.includes('SO-ORIGINAL-LONG-000000001'))
      assert.deepEqual(await page.evaluate(() => window.requests), ['/query/sales/81/order'])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await capture()
      await page.evaluate(() => { window.phoneDetail.销售信息 = { sale_id: 82, has_checkout_order: false } })
      await page.waitForFunction(() => !document.body.textContent.includes('SO-ORIGINAL-LONG-000000001'))
      assert.deepEqual(await page.evaluate(() => window.requests), ['/query/sales/81/order'])
      assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
      await metrics.detach(); await page.close()
      console.log(`手机销售详情 ${width}px ${dark ? '暗' : '明'}：普通销售无整单请求、共同单按真实销售ID读取、切换清理通过`)
      continue
    }
    if (salesMode) {
      await page.evaluate(dark => { document.documentElement.classList.toggle('dark', dark); document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, dark)
      await (purchaseReturn ? verifyPurchaseReturn(page, capture) : filmService ? verifyFilmService(page, capture) : phoneQueryOnly ? verifyQueryPhone(page, capture) : goodsPage ? mode === 'goods-sale' ? verifyQueryGoodsSale(page, capture) : verifyQueryGoods(page, capture) : goodsExchange ? verifyGoodsExchange(page, mode) : phoneReturn ? verifyPhoneReturn(page, mode, capture) : quickSale ? verifyQuickSale(page, capture) : salesPage ? verifySalesPage(page, mode, capture) : verifySalesCheckout(page, mode, capture)).catch(error => { throw new Error(`${mode}/${width}/${dark}: ${error.message}: ${errors.join(' | ')}`, { cause: error }) })
      assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
      await metrics?.detach()
      await page.close()
      const actions = '实际入口/资料继承/公共宽度/取消保留/逐台关联/提交刷新/撤权'
      if (phoneQueryOnly) {
        console.log(`手机查询 ${width}px ${dark ? '暗' : '明'}：普通双击共用详情/贴膜关联/专用字段不叠加/零交易提交通过`)
        continue
      }
      console.log(purchaseReturn ? `采购退供试算 ${width}px ${dark ? '暗' : '明'}：普通/SN、退款/留抵/冲应付、切换失效/迟到响应/失败重试/撤权通过（只读内存服务）` : filmService ? `贴膜办理 ${width}px ${dark ? '暗' : '明'}：跨店/取消/免费及收费/积分净额/原键重试/历史重读/撤权通过（内存服务）` : goodsPage ? `商品查询 ${mode} ${width}px ${dark ? '暗' : '明'}：检索/分页/筛选/原单与售后/失败重试/撤权及迟到响应通过` : goodsExchange ? `商品换货 ${mode} ${width}px ${dark ? '暗' : '明'}：原SN/新销售员/净差价/积分/未知冻结及重试/撤权通过` : phoneReturn ? `手机联合退货 ${mode} ${width}px ${dark ? '暗' : '明'}：原单/收费保留及退回/SN/赠品扣款/退款补款/未知冻结及重试通过` : quickSale ? `快速出库 ${width}px ${dark ? '暗' : '明'}：真实表单/客户继承/公共宽度/取消保留/最新价格/购买赠送/单次合单提交通过` : salesPage ? `销售整页 ${mode} ${width}px ${dark ? '暗' : '明'}：${actions}通过` : `结算组件 ${mode} ${width}px ${dark ? '暗' : '明'}：真实检索/SN/赠送/关联/积分/防重重试/撤权通过`)
      continue
    }
    await page.waitForFunction(value => document.body.textContent.includes(value), {}, sample).catch(error => { throw new Error(error.message + ': ' + errors.join(' | ')) })
    await page.evaluate(dark => { document.documentElement.classList.toggle('dark', dark); document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, dark)
    if (history || film) {
      await (history ? verifyCustomerGoodsHistory(page, capture) : verifyCustomerFilmHistory(page, capture))
      assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
      await page.close()
      console.log(`${history ? '客户商品记录' : '客户贴膜记录'} ${width}px ${dark ? '暗' : '明'}：公共详情/底部动作/分页/权限清理/失败重试及边界通过`)
      continue
    }
    if (receipt) {
      await verifyReceipt(page, temporary, errors)
      assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
      await page.close()
      console.log(`销售凭证 ${width}px ${dark ? '暗' : '明'}：购买/赠品、SN、原净额、打印及连续PNG下载、撤权与重试通过`)
      continue
    }
    const result = await page.evaluate(() => {
      const body = document.querySelector('.mobile-dialog-sheet-body') || document.querySelector('.el-dialog__body')
      const fields = [...body.querySelectorAll('.el-descriptions__content')]
      const viewport = innerWidth
      return { text: body.textContent, overflow: document.documentElement.scrollWidth > viewport + 1,
        outside: fields.filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > viewport + 1 || el.scrollWidth > el.clientWidth + 2 }).map(el => el.textContent),
        vertical: innerWidth < 768 ? body.querySelectorAll('.el-descriptions--vertical').length : null }
    })
    assert.equal(result.overflow, false, `页面横溢出 ${width}/${dark}`)
    assert.deepEqual(result.outside, [], `字段超界 ${width}/${dark}`)
    for (const value of ['原手机型号', '原单通用充电器长名称完整显示', '原赠膜', '原单约定 ¥12.34/件，合计 ¥12.34', '实际扣款以售后核对为准', '000SN1234567890'.repeat(4), '¥115']) assert.ok(result.text.includes(value), value)
    await page.evaluate(() => { window.access.goods = false })
    await page.waitForFunction(() => !document.body.textContent.includes('原赠膜') && !document.body.textContent.includes('末页商品'))
    await page.evaluate(() => { window.fail = true; window.access.goods = true })
    await page.waitForFunction(() => document.body.textContent.includes('隔离读取失败'))
    await page.evaluate(() => { window.fail = false; [...document.querySelectorAll('button')].find(el => el.textContent.trim() === '重试').click() })
    await page.waitForFunction(value => document.body.textContent.includes(value), {}, sample)
    assert.deepEqual(errors, []); assert.deepEqual(blocked, [])
    await page.close()
    console.log(`整单详情 ${width}px ${dark ? '暗' : '明'}：字段完整、无溢出、撤权清理与失败重试通过`)
  }
} finally {
  const cleanup = await Promise.allSettled([browser?.close(), server?.close()])
  const directory = await Promise.allSettled([rm(temporary, { recursive: true, force: true })])
  const failures = [...cleanup, ...directory].filter(result => result.status === 'rejected')
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), '隔离浏览器资源清理失败')
}
