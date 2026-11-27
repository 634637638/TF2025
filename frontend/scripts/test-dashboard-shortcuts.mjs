#!/usr/bin/env node
// 真实首页/系统设置和公共控件；接口及配置只在内存，拒绝业务网络和外部请求。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { clickButton, input, select, field, checkBoundaries } from './lib/sales-checkout-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const { default: puppeteer } = createRequire(resolve(root, '../backend/package.json'))('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-dashboard-shortcuts-'))
const screenshots = process.env.SHORTCUT_SCREENSHOT_DIR
const viewports = (process.argv.find(value => value.startsWith('--viewports='))?.slice('--viewports='.length) || '390,768,1440').split(',').map(Number)
assert.ok(viewports.every(value => Number.isInteger(value) && value >= 320 && value <= 1920), '视口应为320至1920之间的整数')
const entry = `
import {createApp,h,reactive} from 'vue';
import {createPinia} from 'pinia';
import {useAppStore} from '/src/stores/app.ts';
import {createRouter,createMemoryHistory,RouterView} from 'vue-router';
import ElementPlus from 'element-plus';
import MobileDialog from '/src/components/MobileDialog.vue';
import RecordDetailDialog from '/src/components/RecordDetailDialog.vue';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import IconRenderer from '/src/components/IconRenderer.vue';
import SectionLoading from '/src/components/SectionLoading.vue';
import InlineLoading from '/src/components/InlineLoading.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import UnifiedSearchPanel from '/src/components/search/UnifiedSearchPanel.vue';
import Pagination from '/src/components/Pagination.vue';
import InventoryStatsCards from '/src/views/inventory/page/InventoryStatsCards.vue';
import {vTFLoading} from '/src/directives/index.ts';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
import {getNumberColumnMinWidth,getActionColumnMinWidth} from '/src/utils/table-layout.ts';
import {applyDeviceRootClass} from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/admin-layout.css';import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';import '/src/styles/components/_dialog-actions.scss';
window.fixture=reactive({items:[],writes:[],denied:[],unhandledReads:[],activityUnavailable:false,hiddenStats:[]});
const site={siteName:'隔离测试站点',logoUrl:'',siteSubtitle:'',siteDomain:'',icpNumber:'',companyName:'',contactPhone:'',contactEmail:'',companyAddress:'',publicPriceContacts:'',publicPriceDefaultContact:'',publicPriceWatermark:'',publicPriceWatermarkEnabled:'1',publicPriceWatermarkTimeEnabled:'1',publicPriceWatermarkColor:'#6b7280'};
window.read=async(url)=>{
 if(url.startsWith('/system/dashboard-shortcuts'))return {success:true,data:JSON.parse(JSON.stringify(window.fixture.items.filter(item=>url.endsWith('/admin')||item.enabled)))};
 if(url==='/system/site-settings'||url==='/system/site-settings/admin')return {success:true,data:site};
 if(url==='/system/announcements/admin')return {success:true,data:[]};
 if(url==='/system/announcements')return {success:true,data:[{id:1,title:'首页公告示例',content:'<p>本页仅内存数据</p>',isPinned:false}]};
 if(url==='/dashboard')return {success:true,data:{stats:{todaySalesAmount:128450.25,todayPhoneSales:{new_amount:102800.5,used_amount:21720.75,new_count:5,used_count:12},phones:{in_stock:1274,new_count:1274,used_count:0},customers:12486,customerGrowth:innerWidth<=375?{current_month:39,previous_month:58}:{current_month:39,previous_month:1234}}}};
 if(url==='/dashboard/activities'){
   if(window.fixture.activityUnavailable)throw {response:{status:500,data:{message:'服务器内部错误，请稍后重试'}}};
   return {success:true,data:Array.from({length:10},(_,i)=>({id:String(i),type:'sales',icon:'fas fa-shopping-cart',description:'张三销售一台 iPhone '+i,detail:'',occurred_at:'2026-11-26 10:00:00'}))};
 }
 if(url==='/dashboard/my-monthly-stats')return {success:true,data:{sales:{phone_count:42,new_count:26,used_count:16,allocation_count:12,transfer_count:24,goods_quantity:10,commission:123},attendance:{leave_days:1,unpaid_leave_days:2,overtime_hours:3,leave_deduction:300,overtime_pay:90}}};
 if(url==='/colors')return {success:true,data:{colors:[],pagination:{total:0,page:1,page_size:100}}};
 if(url==='/colors/stats/overview')return {success:true,data:{}};
 if(url==='/screen-lock')return {success:true,data:{}};
 if(url==='/screen-lock/query-users')return {success:true,data:[]};
 window.fixture.unhandledReads.push(url);throw Error('未登记的隔离读取：'+url);
};
window.write=async(method,url,data)=>{
 if(!url.startsWith('/system/dashboard-shortcuts'))throw Error('禁止非快捷配置写入');
 window.fixture.writes.push({method,url,data});
 if(method==='post')window.fixture.items.push({id:crypto.randomUUID(),...data});
 if(method==='put')Object.assign(window.fixture.items.find(item=>url.endsWith(item.id)),data);
 if(method==='delete')window.fixture.items=window.fixture.items.filter(item=>!url.endsWith(item.id));
 return {success:true,data:JSON.parse(JSON.stringify(window.fixture.items))};
};
const Dashboard=(await import('/src/views/dashboard/DashboardView.vue')).default;
const System=(await import('/src/views/system/SystemView.vue')).default;
const Colors=(await import('/src/views/colors/ColorsView.vue')).default;
const inventoryStats=[
  {key:'total',label:'手机总数',value:47},
  {key:'new',label:'全新机数量',value:28},
  {key:'used',label:'二手机数量',value:19},
  {key:'value',label:'库存总值',value:'¥128450.25'}
].map(stat=>({...stat,icon:'fas fa-mobile-alt',accentClass:'stat-card--primary'}));
const InventoryStatsFixture={render:()=>h('main',{class:'admin-page'},h('div',{class:'admin-page-content'},
  h(InventoryStatsCards,{visible:true,loading:false,stats:inventoryStats.slice(0,4-window.fixture.hiddenStats.length)})))};
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{render:()=>h(RouterView)},meta:{requiresAuth:true},children:[
 {path:'dashboard',component:Dashboard,meta:{title:'首页'}},{path:'system',component:System,meta:{title:'系统设置'}},{path:'colors',component:Colors,meta:{title:'颜色管理'}},
 {path:'inventory-stats-fixture',component:InventoryStatsFixture,meta:{title:'库存统计测试'}},
 ...[['inventory','手机库存'],['accessories','配件管理'],['query','综合查询']].map(([path,title])=>({path,component:{render:()=>h('div','目标页面')},meta:{title}}))
]}]});
await router.push('/system');await router.isReady();window.navigate=path=>router.push(path);window.currentRoute=()=>router.currentRoute.value.fullPath;
applyDeviceRootClass();const app=createApp({render:()=>h(RouterView)});app.use(createPinia());app.use(router);app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,RecordDetailDialog,RecordDescriptions,IconRenderer,SectionLoading,InlineLoading,DataEmptyState,UnifiedSearchPanel,Pagination}))app.component(name,component);
app.directive('permission',{});app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);
app.config.globalProperties.$getNumberColumnWidth=getNumberColumnMinWidth;app.config.globalProperties.$getActionColumnWidth=getActionColumnMinWidth;
app.mount('#app');window.setTheme=theme=>useAppStore().setTheme(theme);window.ready=true;
`
const mocks = new Map([
  [resolve(root, 'src/utils/unified-api.ts'), 'export const unifiedApi={get:(url)=>window.read(url),post:(url,data)=>window.write(\'post\',url,data),put:(url,data)=>window.write(\'put\',url,data),delete:url=>window.write(\'delete\',url),clearCache:()=>{}};export default unifiedApi;'],
  [resolve(root, 'src/stores/auth.ts'), 'export const useAuthStore=()=>({user:{id:7,name:\'样本员工\'},isAuthenticated:true,userPermissions:[\'*\'],hasPermission:permission=>!window.fixture.denied.includes(permission)});'],
  [resolve(root, 'src/composables/useFieldPermissions.ts'), 'const visible=(module,field)=>module!==\'dashboard\'||field.startsWith(\'stats.\')&&!window.fixture.hiddenStats.includes(field)||field===\'activities.recent\';export const fieldPermissions={init:async()=>{},isFieldVisible:visible,isFieldEditable:()=>true};export const shouldShowActionColumn=()=>true;export const useFieldPermissions=()=>fieldPermissions;']
])

const statFields = ['stats.today_sales', 'stats.monthly_sales', 'stats.total_products', 'stats.monthly_attendance', 'stats.total_customers', 'stats.pending_repairs']

async function verifyStatCardLayout(page, width, fields = statFields) {
  const region = fields === statFields ? '.dashboard-stats' : '[aria-label="手机库存统计"]'
  const minHeight = width < 768 ? 70 : 88
  const readLayout = () => page.$eval(region, rail => {
    const bounds = rail.getBoundingClientRect()
    const cards = [...rail.querySelectorAll(':scope > .stat-card')].map(card => card.getBoundingClientRect())
    const rows = new Map()
    for (const card of cards) {
      if (card.left >= bounds.left - 1 && card.right <= bounds.right + 1) {
        rows.set(Math.round(card.top), (rows.get(Math.round(card.top)) ?? 0) + 1)
      }
    }
    return {
      rows: [...rows.values()],
      heights: cards.map(card => card.height),
      widths: cards.map(card => card.width),
      rightGap: Math.abs(bounds.right - Math.max(...cards.map(card => card.right))),
      overflow: rail.scrollWidth > rail.clientWidth + 1,
      scrollbar: getComputedStyle(rail).scrollbarWidth,
      textFits: [...rail.querySelectorAll('.stat-content')].every(content => content.scrollWidth <= content.clientWidth + 1),
      labelValueOrder: [...rail.querySelectorAll(':scope > .stat-card > .stat-content')].every(content => {
        const label = content.querySelector('.stat-label, h3')
        const value = content.querySelector('.stat-value, .stat-number, .stat-value-primary')
        if (!label || !value) return true
        return label.getBoundingClientRect().top < value.getBoundingClientRect().top
      }),
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1
    }
  })

  const assertLayout = (layout, rows, overflow) => {
    assert.deepEqual(layout.rows, rows, `首屏卡片排列 ${width}px`)
    assert.ok(Math.max(...layout.heights) - Math.min(...layout.heights) < 1, `同组卡片等高 ${width}px`)
    assert.ok(Math.min(...layout.heights) >= minHeight, `卡片使用公共最小高度 ${width}px`)
    assert.ok(Math.max(...layout.widths) - Math.min(...layout.widths) < 1, `卡片等宽 ${width}px`)
    assert.equal(layout.overflow, overflow, '超出的卡片仅在统计区域横滑')
    if (!overflow) assert.ok(layout.rightGap <= 1, `按实际张数铺满 ${width}px`)
    assert.equal(layout.scrollbar, 'none', '隐藏可见横向滚动条')
    assert.equal(layout.textFits, true, `卡片数值和标签完整显示 ${width}px`)
    assert.equal(layout.labelValueOrder, true, `卡片标题在上、主值在下 ${width}px`)
    assert.equal(layout.pageOverflow, false, '横滑不撑宽页面')
  }

  for (let count = 1; count <= fields.length; count++) {
    await page.evaluate(hidden => { window.fixture.hiddenStats = hidden }, fields.slice(count))
    await page.waitForFunction((region, count) => document.querySelectorAll(region + ' > .stat-card').length === count, {}, region, count)
    const layout = await readLayout()
    const columnLimit = width < 768
      ? 2
      : width <= 1024
        ? count >= 5 && count <= 6 ? 3 : 4
        : 6
    const rows = width < 768
      ? count > 2 ? [2, Math.min(2, count - 2)] : [count]
      : width <= 1024
        ? count > 4 ? [columnLimit, Math.min(columnLimit, count - columnLimit)] : [count]
        : [Math.min(count, columnLimit)]
    const overflow = width < 768 ? count > 4 : width <= 1024 ? count > 8 : count > 6
    assertLayout(layout, rows, overflow)
    if (width < 768 && count === 1) {
      assert.ok(layout.heights[0] <= 104, `单行内容的紧凑卡片不超过手机卡片高度上限 ${width}px`)
    }
  }

  if (fields.length === 4) return
  if (width >= 768) {
    const extraCount = width <= 1024 ? 3 : 1
    await page.$eval(region, (rail, count) => {
      for (let index = 0; index < count; index++) {
        const card = rail.lastElementChild.cloneNode(true)
        card.dataset.fixtureExtra = ''
        rail.append(card)
      }
    }, extraCount)
    const visibleRows = width <= 1024 ? [4, 4] : [6]
    assertLayout(await readLayout(), visibleRows, true)
  }
  if (width >= 1025) {
    await page.focus(region)
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(region => document.querySelector(region).scrollLeft > 0, { timeout: 3000 }, region)
    await page.$eval(region, rail => rail.blur())
  }
  await page.$eval(region, rail => rail.scrollTo({ left: rail.scrollWidth, behavior: 'instant' }))
  await page.waitForFunction(() => {
    const rail = document.querySelector('.dashboard-stats')
    return rail.scrollLeft > 0 && rail.lastElementChild.getBoundingClientRect().right <= rail.getBoundingClientRect().right + 1
  }, { timeout: 3000 })
  await page.$eval(region, rail => {
    rail.querySelectorAll('[data-fixture-extra]').forEach(card => card.remove())
    rail.scrollTo({ left: 0, behavior: 'instant' })
  })
}

let server, browser, activePage
try {
  if (screenshots) await mkdir(screenshots, { recursive: true })
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'), logLevel: 'error',
    resolve: { alias: { '@': resolve(root, 'src') } },
    optimizeDeps: { noDiscovery: true, include: ['vue', 'vue-router', 'pinia', 'element-plus', '@element-plus/icons-vue', 'vuedraggable', 'dompurify', 'aos', 'lodash.debounce', 'lodash.throttle', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    plugins: [vue(), { name: 'isolated-dashboard-shortcuts', enforce: 'pre',
      resolveId: id => id === '/__shortcut-entry.js' ? '\0shortcut-entry' : undefined,
      load: id => id === '\0shortcut-entry' ? entry : mocks.get(id),
      configureServer(vite) { vite.middlewares.use((req, res, next) => {
        if (req.url === '/__shortcuts.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__shortcut-entry.js"></script></body></html>'); return }
        if (req.method !== 'GET' || req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('禁止业务请求'); return }
        next()
      }) }
    }], server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: join(temporary, 'chrome') })
  let cases = 0
  for (const width of viewports) for (const dark of [false, true]) {
    const page = await browser.newPage(), errors = [], blocked = []
    activePage = page
    await page.setViewport({ width, height: 950, isMobile: width < 768, hasTouch: width < 768 })
    await page.evaluateOnNewDocument((width, dark) => {
      Object.defineProperty(screen, 'width', { get: () => width }); Object.defineProperty(screen, 'availWidth', { get: () => width })
      document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' })
    }, width, dark)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.setRequestInterception(true)
    page.on('request', request => {
      const url = new URL(request.url())
      if (['data:', 'blob:'].includes(url.protocol) || (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/'))) request.continue()
      else { blocked.push(`${request.method()} ${url.pathname}`); request.abort() }
    })
    await page.goto(`${origin}/__shortcuts.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.ready === true && document.body.textContent.includes('新增快捷方式')).catch(async error => {
      const state = await page.evaluate(() => ({ ready: window.ready, text: document.body.textContent.slice(0, 2000), html: document.getElementById('app')?.innerHTML.slice(0, 2000) }))
      throw new Error([error.message, JSON.stringify(state), ...errors].join('\n'))
    })
    await page.evaluate(dark => window.setTheme(dark ? 'dark' : 'light'), dark)
    await page.waitForFunction(dark => document.documentElement.dataset.theme === (dark ? 'dark' : 'light'), {}, dark)
    const buttons = await page.$$eval('.site-logo-panel .card-header-with-action .el-button, .site-settings-table .card-header-with-action .el-button', elements => elements.map(element => {
      // 公共令牌可以是clamp等响应式表达式，交由浏览器求值，不把它当作纯像素字符串解析。
      const probe = document.createElement('div')
      probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--tf-button-height);width:0;pointer-events:none'
      element.append(probe)
      const expected = probe.getBoundingClientRect().height
      probe.remove()
      return { size: ['small', 'large'].some(size => element.classList.contains('el-button--' + size)), height: element.getBoundingClientRect().height, expected }
    }))
    assert.equal(buttons.length, 2)
    for (const button of buttons) { assert.equal(button.size, false); assert.equal(button.height, button.expected, JSON.stringify(button)) }
    await clickButton(page, '新增快捷方式')
    await page.waitForSelector('.tf-form-row--three')
    const rows = await page.$$eval('.tf-form-row--three', elements => elements.map(row => [...row.querySelectorAll('.el-form-item')].map(item => ({ top: item.getBoundingClientRect().top, left: item.getBoundingClientRect().left }))))
    assert.equal(rows.length, 2)
    for (const row of rows) {
      assert.equal(row.length, 3)
      assert.ok(Math.abs(row[0].top - row[1].top) < 2, '短字段同一行')
      assert.ok(row[1].left > row[0].left)
      if (width >= 768) assert.ok(Math.abs(row[0].top - row[2].top) < 2, '电脑和平板每行三个字段')
      else assert.ok(row[2].top > row[0].top, '手机第三项独占下一行')
    }
    await select(page, '入口类型', '功能')
    await select(page, '目标功能', '商品销售')
    await input(page, '显示名称', '商品收银')
    await checkBoundaries(page)
    if (screenshots && !dark && width !== 768) await page.screenshot({ path: join(screenshots, `shortcut-form-${width}.png`), fullPage: true })
    await clickButton(page, '保存')
    await page.waitForFunction(() => window.fixture.items.length === 1 && ![...document.querySelectorAll('.tf-form-row--three')].some(element => element.checkVisibility()))
    assert.equal(await page.evaluate(() => window.fixture.items[0].target), 'goods-sale')
    await page.evaluate(() => {
      window.fixture.activityUnavailable = true
      return window.navigate('/dashboard')
    })
    await page.waitForFunction(() => document.body.textContent.includes('首页公告示例') && document.body.textContent.includes('商品收银'))
    await page.waitForSelector('.recent-activity [role="alert"]')
    assert.match(await page.$eval('.recent-activity [role="alert"]', alert => alert.textContent), /最近活动读取失败/)
    assert.ok(await page.$('.dashboard-stats .stat-number'), '活动接口失败时统计卡片继续显示')
    await page.evaluate(() => { window.fixture.activityUnavailable = false })
    await page.$eval('.recent-activity [role="alert"] button', button => button.click())
    await page.waitForSelector('.recent-activity .activity-item')
    assert.equal(await page.$('.recent-activity [role="alert"]'), null)
    assert.ok(await page.$$eval('.dashboard-stats h3', headings => headings.some(heading => heading.textContent.trim() === '本月销售')))
    const statCards = await page.$$eval('.dashboard-stats > .stat-card', cards => cards.map(card => {
      const bounds = card.getBoundingClientRect()
      const main = card.querySelector('.stat-content')
      const details = card.querySelector('.stat-card__details')
      const detailBounds = details?.getBoundingClientRect()
      const icon = card.querySelector('.stat-icon')
      const iconBounds = icon.getBoundingClientRect()
      const mainBounds = main.getBoundingClientRect()
      const heading = main.querySelector('h3')
      const value = main.querySelector('.stat-number')
      const detailRows = [...(details?.children ?? [])].filter(row => row.checkVisibility())
      const detailPositions = detailRows.map(row => {
        const { left, top } = row.getBoundingClientRect()
        return [Math.round(left), Math.round(top)]
      })
      const detailPairsInline = detailRows.every(row => {
        const label = row.querySelector('dt').getBoundingClientRect()
        const value = row.querySelector('dd').getBoundingClientRect()
        return Math.abs(label.top - value.top) < 1 && label.right <= value.left + 1 && value.height <= label.height + 1
      })
      const detailEdges = (selector, edge = 'right') => detailRows.map(row => {
        const cell = row.querySelector(selector)
        return cell?.checkVisibility() ? Math.round(cell.getBoundingClientRect()[edge]) : null
      })
      return {
        title: heading.textContent.trim(),
        valueBelowTitle: value.getBoundingClientRect().top >= heading.getBoundingClientRect().bottom - 1,
        left: bounds.left, top: bounds.top, height: bounds.height,
        value: value.textContent.trim(),
        valueInline: value.getBoundingClientRect().height <= parseFloat(getComputedStyle(value).lineHeight) + 1,
        lines: detailRows.map(row => row.innerText.replace(/\s+/g, '')),
        sideBySide: detailBounds && detailBounds.left >= mainBounds.right - 1,
        stacked: detailBounds && detailBounds.top >= mainBounds.bottom - 1 && detailBounds.left <= mainBounds.left,
        layerGap: detailBounds && detailBounds.top - Math.max(iconBounds.bottom, mainBounds.bottom),
        detailPairsInline,
        detailRows: new Set(detailPositions.map(([, top]) => top)).size,
        detailPositions,
        detailQuantityEdges: detailEdges('.stat-card__detail-quantity'),
        detailQuantityStarts: detailEdges('.stat-card__detail-quantity', 'left'),
        detailAmountEdges: detailEdges('.stat-card__detail-amount'),
        detailAmountLabelStarts: detailEdges('.stat-card__detail-amount-label', 'left'),
        detailAmountValueEnds: detailEdges('.stat-card__detail-amount-value'),
        dividedColumns: detailRows.filter(row => getComputedStyle(row, '::before').borderInlineStartStyle === 'dashed').length,
        dividedLabels: detailRows.filter(row => getComputedStyle(row.querySelector('dt')).borderInlineEndStyle === 'dashed').length,
        amountDividerEdges: detailRows.flatMap(row => {
          const amount = row.querySelector('.stat-card__detail-amount')
          return amount && getComputedStyle(amount).borderInlineStartStyle === 'dashed' ? [amount.getBoundingClientRect().left] : []
        }),
        iconVisible: icon.checkVisibility() && iconBounds.width > 0 && iconBounds.height > 0 &&
          iconBounds.left >= bounds.left && iconBounds.right <= mainBounds.left + 1,
        mainWidth: main.clientWidth,
        detailWidth: details?.clientWidth,
        fits: [...card.querySelectorAll('.stat-content, .stat-card__details, dd')].every(element => (
          element.scrollWidth <= element.clientWidth + 1
        ))
      }
    }))
    const previousMonth = width <= 375 ? '58' : '1,234'
    for (const [title, value, lines] of [
      ['今日销售', '¥128450.25', [
        `全新${width >= 768 ? '5台' : ''}${width >= 1025 ? '金额' : ''}¥102800.5`,
        `二手${width >= 768 ? '12台' : ''}${width >= 1025 ? '金额' : ''}¥21720.75`
      ]],
      ['本月销售', '42台', [...(width < 768 ? [] : ['全新26台', '二手16台', '划拨12台', '调货24台']), '商品10件', '提成¥123']],
      ['库存商品', '1,274台', ['全新1,274台', '二手0台']],
      ['本月考勤', '1天休假', width >= 1025 ? ['请假2天扣款300元', '加班3小时补贴90元'] : ['请假2天300元', '加班3小时90元']],
      ['客户总数', '12,486', width < 768 ? ['本月+39人', `上月+${previousMonth}人`] : ['本月新增39人', `上月新增${previousMonth}人`]]
    ]) {
      const card = statCards.find(item => item.title === title)
      assert.equal(title === '本月销售' ? card?.value : card?.value.replace(/\s+/g, ''), value, title)
      assert.deepEqual(card?.lines, lines, title)
      if (title === '本月销售' && width >= 768) {
        assert.ok(card.sideBySide || card.stacked, '月度明细在主数字右侧或整组换到下方')
        const [[first, top], [firstBottom, bottom], [second, secondTop], [secondBottom, secondRow], [third, thirdTop], [thirdBottom, thirdRow]] = card.detailPositions
        assert.ok(first < second && second < third && top < bottom, '月度明细为三列两行')
        assert.deepEqual([firstBottom, secondBottom, thirdBottom], [first, second, third])
        assert.deepEqual([secondTop, thirdTop, secondRow, thirdRow], [top, top, bottom, bottom])
        assert.ok(card.detailPairsInline, `${width}px 月度明细标签和数值同行 ${JSON.stringify(card)}`)
        assert.equal(card.dividedColumns, 4, '划拨、调货和商品、提成所在列以虚线分隔')
      } else if (title === '今日销售' && width >= 768) {
        assert.ok(card.sideBySide || card.stacked, '今日销售明细在主金额右侧或整组换到下方')
        assert.ok(card.valueBelowTitle, `${width}px 今日销售总金额在标题下方`)
        assert.ok(card.detailPairsInline, `${width}px 今日销售成色、台数和金额同行 ${JSON.stringify(card)}`)
        const [newQuantity, usedQuantity] = card.detailQuantityEdges
        const [newAmount, usedAmount] = card.detailAmountEdges
        assert.ok(typeof newQuantity === 'number' && newQuantity === usedQuantity, '全新和二手台数右对齐')
        assert.ok(newAmount > newQuantity && newAmount === usedAmount, '全新和二手金额独立右对齐')
        if (width < 1025) assert.equal(card.dividedLabels, 2, '平板端成色与右侧数值用虚线分隔')
      } else if (title === '本月考勤' && width >= 768) {
        assert.ok(card.sideBySide || card.stacked, '考勤明细在休假天数右侧或下方')
        assert.ok(card.detailPairsInline, `${width}px 考勤时长和金额同行 ${JSON.stringify(card)}`)
        const [deductionEnd, subsidyEnd] = card.detailAmountEdges
        assert.ok(typeof deductionEnd === 'number' && deductionEnd === subsidyEnd, '扣款和补贴在独立金额列右对齐')
      } else {
        assert.ok(width < 768 ? card.stacked : card.sideBySide, `${title}主数值和明细按视口排版`)
      }
      if (width >= 1025 && (title === '今日销售' || title === '本月考勤')) {
        const [firstDivider, secondDivider] = card.amountDividerEdges
        assert.equal(card.amountDividerEdges.length, 2, `${title}金额列左侧有竖线`)
        assert.equal(firstDivider, secondDivider, `${title}两行金额的分割线对齐`)
        assert.equal(card.dividedLabels, 0, `${title}标签和数量在分割线同侧`)
        const [firstQuantity, secondQuantity] = card.detailQuantityStarts
        const [firstAmountLabel, secondAmountLabel] = card.detailAmountLabelStarts
        const [firstAmountValue, secondAmountValue] = card.detailAmountValueEnds
        assert.ok(firstQuantity < firstDivider && firstQuantity === secondQuantity, `${title}数量左对齐`)
        assert.ok(firstDivider < firstAmountLabel && firstAmountLabel === secondAmountLabel, `${title}金额标签左对齐`)
        assert.ok(firstAmountLabel < firstAmountValue && firstAmountValue === secondAmountValue, `${title}金额右对齐`)
      }
      if (width < 768) {
        assert.ok(Math.abs(card.layerGap - 12) < 2, `${title}两层内容间距为 12px`)
        assert.ok(card.valueInline, `${title}主数值完整同行`)
        assert.ok(card.detailPairsInline, `${title}明细标签和对应数值同行`)
        if (title === '客户总数' || title === '库存商品') {
          assert.equal(card.detailRows, 1, `${title}两组明细在手机端同排`)
        }
      }
    }
    assert.ok(statCards.every(card => card.iconVisible), JSON.stringify(statCards))
    assert.ok(statCards.every(card => card.fits), JSON.stringify(statCards))
    if (width < 768) assert.ok(statCards.every(card => card.height <= 104), JSON.stringify(statCards))
    await verifyStatCardLayout(page, width)
    await page.bringToFront()
    await page.mouse.move(0, 0)
    await page.waitForFunction(() => document.querySelector('.activity-list')?.scrollTop > 0, { timeout: 9000 }).catch(async error => {
      const state = await page.$eval('.activity-list', list => ({
        scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, scrollTop: list.scrollTop,
        visibility: document.visibilityState, hovered: list.matches(':hover'), focused: list.contains(document.activeElement),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        itemOffsets: [...list.children].slice(0, 3).map(item => item.offsetTop)
      }))
      throw new Error([error.message, JSON.stringify(state), ...errors].join('\n'))
    })
    await page.$eval('[aria-label="暂停活动滚动"]', button => button.click())
    await page.waitForSelector('[aria-label="继续活动滚动"]')
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.waitForSelector('[aria-label="继续活动滚动"]', { hidden: true })
    assert.equal(await page.$eval('.dashboard-shortcuts', element => element.getBoundingClientRect().top >= document.querySelector('.dashboard-announcements').getBoundingClientRect().bottom), true)
    const shortcutButtons = await page.$$eval('.dashboard-shortcuts .el-button', elements => elements.map(element => {
      const style = getComputedStyle(element)
      const probe = document.createElement('div')
      probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--tf-button-compact-height);padding-left:var(--tf-button-compact-padding-x);font-size:var(--tf-button-font-size-small);pointer-events:none'
      element.append(probe)
      probe.style.backgroundColor = 'var(--tf-button-primary-soft-bg)'
      probe.style.borderColor = 'var(--tf-button-primary-soft-border)'
      probe.style.color = 'var(--tf-button-primary-soft-color)'
      const expected = { height: probe.getBoundingClientRect().height, padding: getComputedStyle(probe).paddingLeft, fontSize: getComputedStyle(probe).fontSize,
        background: getComputedStyle(probe).backgroundColor, border: getComputedStyle(probe).borderColor, color: getComputedStyle(probe).color }
      probe.remove()
      return { height: element.getBoundingClientRect().height, padding: style.paddingLeft, fontSize: style.fontSize,
        background: style.backgroundColor, border: style.borderColor, color: style.color,
        iconColor: getComputedStyle(element.querySelector('.icon-renderer')).color, expected }
    }))
    assert.equal(shortcutButtons.length, 1)
    for (const button of shortcutButtons) {
      assert.equal(button.height, button.expected.height, '首页快捷方式使用公共紧凑高度')
      assert.equal(button.padding, button.expected.padding, '首页快捷方式使用公共紧凑内边距')
      assert.equal(button.fontSize, button.expected.fontSize, '首页快捷方式使用公共紧凑字号')
      assert.equal(button.background, button.expected.background, '首页快捷方式使用公共浅色背景')
      assert.equal(button.border, button.expected.border, '首页快捷方式使用公共浅色边框')
      assert.equal(button.color, button.expected.color, '首页快捷方式使用公共主色文字')
      assert.equal(button.iconColor, button.color, '快捷方式图标与文字同色')
    }
    await checkBoundaries(page)
    if (screenshots && !dark && width !== 768) await page.screenshot({ path: join(screenshots, `shortcut-home-${width}.png`), fullPage: true })
    await clickButton(page, '商品收银')
    await page.waitForFunction(() => window.currentRoute() === '/query?mode=goods&openSale=true')
    await page.evaluate(() => window.navigate('/system'))
    await page.waitForFunction(() => document.body.textContent.includes('新增快捷方式'))
    await clickButton(page, '新增快捷方式')
    await select(page, '入口类型', '功能')
    const target = await field(page, '目标功能')
    await (await target.$('.el-select')).click()
    await (await target.$('input')).type('颜色管理')
    await page.waitForFunction(() => [...document.querySelectorAll('.el-select-dropdown__item')].some(item => item.checkVisibility() && item.textContent.includes('新增颜色')))
    await page.keyboard.press('Escape')
    await select(page, '目标功能', '新增颜色')
    await clickButton(page, '保存')
    await page.waitForFunction(() => window.fixture.items.length === 2)
    await page.evaluate(() => window.navigate('/dashboard'))
    await page.waitForFunction(() => [...document.querySelectorAll('.dashboard-shortcuts .el-button')].some(item => item.textContent.includes('新增颜色')))
    await clickButton(page, '新增颜色')
    await page.waitForFunction(() => window.currentRoute() === '/colors' && [...document.querySelectorAll('.el-dialog,.mobile-dialog-sheet')].some(item => item.checkVisibility() && item.textContent.includes('新增颜色'))).catch(async error => {
      const state = await page.evaluate(() => ({ route: window.currentRoute(), text: document.body.textContent.slice(0, 2000) }))
      throw new Error([error.message, JSON.stringify(state), ...errors].join('\n'))
    })
    await checkBoundaries(page)
    await clickButton(page, '取消')
    const colorStats = await page.$eval('[aria-label="颜色统计"]', group => {
      const cards = [...group.querySelectorAll(':scope > .stat-card')].map(card => card.getBoundingClientRect())
      const bounds = group.getBoundingClientRect()
      const visibleCards = cards.filter(card => card.left >= bounds.left - 1 && card.right <= bounds.right + 1)
      return {
        count: cards.length,
        equalHeight: cards.every(card => card.height === cards[0].height),
        rows: new Set(visibleCards.map(card => Math.round(card.top))).size,
        fillsWidth: Math.abs(bounds.right - Math.max(...visibleCards.map(card => card.right))) < 1,
        scrolls: group.scrollWidth > group.clientWidth + 1,
        scrollbar: getComputedStyle(group).scrollbarWidth
      }
    })
    assert.ok(colorStats.count > 0 && colorStats.count <= 4)
    const colorCapacity = width < 768 ? 4 : width <= 1024 ? 8 : 6
    const colorRows = width < 768 && colorStats.count > 2 ? 2 : 1
    assert.ok(colorStats.equalHeight && colorStats.rows === colorRows)
    assert.equal(colorStats.scrolls, colorStats.count > colorCapacity)
    if (!colorStats.scrolls) assert.ok(colorStats.fillsWidth)
    assert.equal(colorStats.scrollbar, 'none')
    await page.evaluate(() => { window.fixture.denied = ['colors:create']; return window.navigate('/dashboard') })
    await page.waitForFunction(() => ![...document.querySelectorAll('.dashboard-shortcuts .el-button')].some(item => item.textContent.includes('新增颜色')))
    await page.evaluate(() => window.navigate('/colors?shortcut=color-create'))
    await page.waitForFunction(() => window.currentRoute() === '/colors')
    assert.equal(await page.$$eval('.el-dialog,.mobile-dialog-sheet', items => items.some(item => item.checkVisibility() && item.textContent.includes('新增颜色'))), false)
    await page.evaluate(() => {
      const sample = window.fixture.items[0]
      window.fixture.items = ['手机入库', '配件销售', '商品模板', '库存查询', '客户管理', '商品销售', '员工管理', '客户新增', '维修登记', '批发销售', '长名称快捷方式'.repeat(5), '销售统计'].map((label, index) => ({ ...sample, id: 'density-' + index, label }))
      return window.navigate('/dashboard')
    })
    await page.waitForFunction(() => document.querySelectorAll('.dashboard-shortcuts .el-button').length === 12)
    const shortcutLayout = await page.$$eval('.dashboard-shortcuts .el-button', elements => {
      const bounds = document.querySelector('.dashboard-shortcuts .el-card__body').getBoundingClientRect()
      return { left: bounds.left, right: bounds.right, buttons: elements.map(element => {
        const rect = element.getBoundingClientRect()
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height, title: element.title }
      }), list: (() => {
        const element = document.querySelector('.dashboard-shortcuts__list')
        const rect = element.getBoundingClientRect()
        return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, left: rect.left, right: rect.right,
          rows: [...new Set([...elements].slice(0, 9).map(button => Math.round(button.getBoundingClientRect().top)))],
          headerDisplay: getComputedStyle(document.querySelector('.dashboard-shortcuts .el-card__header')).display }
      })() }
    })
    if (width < 768) {
      assert.equal(shortcutLayout.list.headerDisplay, 'none', '手机端隐藏快捷方式标题栏')
      assert.equal(shortcutLayout.list.rows.length, 3, '手机端固定三行，最多同时显示三列')
      assert.ok(shortcutLayout.list.scrollWidth > shortcutLayout.list.clientWidth, '快捷方式超出三列后可横向滑动')
      assert.ok(shortcutLayout.buttons.slice(0, 9).every(button => button.left >= shortcutLayout.list.left - 1 && button.right <= shortcutLayout.list.right + 1), '手机端首屏最多显示三列')
      for (const row of [0, 1, 2]) {
        const buttons = shortcutLayout.buttons.slice(row * 3, row * 3 + 3)
        assert.ok(buttons.every(button => Math.abs(button.top - buttons[0].top) <= 1), '手机端快捷方式按行排列')
        assert.ok(buttons[1].left > buttons[0].left && buttons[2].left > buttons[1].left, '手机端每行从左到右排列')
      }
      assert.ok(shortcutLayout.buttons[9].left >= shortcutLayout.list.right - 1, '第十个快捷方式从第二页开始')
      await page.evaluate(() => {
        window.fixture.densityItems = [...window.fixture.items]
        window.fixture.items = window.fixture.items.slice(0, 10)
        return window.navigate('/system')
      })
      await page.waitForFunction(() => document.body.textContent.includes('新增快捷方式'))
      await page.evaluate(() => window.navigate('/dashboard'))
      await page.waitForFunction(() => document.querySelectorAll('.dashboard-shortcuts .el-button').length === 10)
      const partialPages = await page.$$eval('.dashboard-shortcuts__page', pages => pages.map(page => ({
        buttons: page.querySelectorAll('.el-button').length,
        rows: new Set([...page.querySelectorAll('.el-button')].map(button => Math.round(button.getBoundingClientRect().top))).size
      })))
      assert.deepEqual(partialPages, [{ buttons: 9, rows: 3 }, { buttons: 1, rows: 1 }], '快捷方式分页按实际数量收敛行数')
      await page.evaluate(() => {
        window.fixture.items = window.fixture.densityItems
        return window.navigate('/system')
      })
      await page.waitForFunction(() => document.body.textContent.includes('新增快捷方式'))
      await page.evaluate(() => window.navigate('/dashboard'))
      await page.waitForFunction(() => document.querySelectorAll('.dashboard-shortcuts .el-button').length === 12)
    } else {
      for (let index = 0; index < shortcutLayout.buttons.length; index++) {
        const button = shortcutLayout.buttons[index]
        assert.ok(button.left >= shortcutLayout.left - 1 && button.right <= shortcutLayout.right + 1, '短名称及长名称按钮均不超出卡片')
        if (index > 0) {
          const previous = shortcutLayout.buttons[index - 1]
          assert.ok(button.left >= previous.right || button.top >= previous.bottom, '按内容自动换行，不重叠')
        }
      }
    }
    await checkBoundaries(page)
    if (screenshots && width !== 768) await page.screenshot({ path: join(screenshots, `shortcut-density-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true })
    assert.equal(await page.evaluate(() => window.fixture.writes.length), 2, '功能跳转只打开表单，不创建业务记录')
    assert.deepEqual(blocked, []); assert.deepEqual(errors, [])
    assert.deepEqual(await page.evaluate(() => [...window.fixture.unhandledReads]), [], '全部读取都须显式隔离，不能吞掉业务读取失败')
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), dark ? 'dark' : 'light', '整个场景保持实际主题，不能被初始化覆盖')
    await page.evaluate(() => window.navigate('/inventory-stats-fixture'))
    await page.waitForSelector('[aria-label="手机库存统计"] > .stat-card')
    await verifyStatCardLayout(page, width, statFields.slice(0, 4))
    const legacyCardOrder = await page.evaluate(() => {
      const fixture = document.createElement('section')
      fixture.className = 'admin-page'
      fixture.innerHTML = '<div class="stats-cards"><div class="stat-card el-card"><div class="el-card__body"><div class="stat-content"><div class="stat-icon"></div><div class="stat-info"><div class="stat-value">42</div><div class="stat-label">数量</div></div></div></div></div></div>'
      document.body.append(fixture)
      const label = fixture.querySelector('.stat-label').getBoundingClientRect()
      const value = fixture.querySelector('.stat-value').getBoundingClientRect()
      fixture.remove()
      return label.top < value.top
    })
    assert.equal(legacyCardOrder, true, `Element Plus嵌套统计卡标题在上、主值在下 ${width}px`)
    await page.close(); cases++
    console.log(`通过：首页快捷方式、仪表盘及库存统计卡片 ${width}px ${dark ? '深色' : '浅色'}`)
  }
  console.log(`快捷方式隔离浏览器 ${cases} 场景通过，真实业务请求0。`)
} catch (error) {
  if (screenshots && activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: join(screenshots, 'shortcut-failure.png'), fullPage: true })
  }
  throw error
} finally {
  await browser?.close(); await server?.close(); await rm(temporary, { recursive: true, force: true })
}
