import assert from 'node:assert/strict'
import { salesEnvironment, clickVisible, clickButton, checkBoundaries, input, select } from './sales-checkout-browser-fixture.mjs'

// 商品查询挂载商品面板；销售及手机查询挂载真实综合查询页，所有数据仅在当前页内存。
export const queryGoodsEntry = `${salesEnvironment}
import {vTFLoading} from '/src/directives/index.ts';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
import {getNumberColumnMinWidth} from '/src/utils/table-layout.ts';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import TableLoadingRow from '/src/components/TableLoadingRow.vue';
import Pagination from '/src/components/Pagination.vue';
import DateRangePicker from '/src/components/DateRangePicker.vue';
import IconRenderer from '/src/components/IconRenderer.vue';
import SearchActionButton from '/src/components/search/SearchActionButton.vue';
import InlineLoading from '/src/components/InlineLoading.vue';
import {vIdentifierInput} from '/src/directives/identifier-input.ts';
import {initScrollAnimations} from '/src/utils/scrollAnimation.ts';
import {createRouter,createMemoryHistory,RouterView} from 'vue-router';
const {default:Panel}=await import('/src/views/query/page/QueryGoodsPanel.vue');
const first={id:51,accessory_id:5,order_id:10,order_item_id:101,sale_no:'AS-ORIGINAL-51',order_no:'SO-ORIGINAL-10',
  linked_phone_invoice:'PHONE-ORIGINAL-1',sale_type:'sale',store_id:1,store_name:'一店',name:'原单充电器',
  barcode:'000123',category:'充电头',brand_name:'实际品牌',product_model:'MWVW3CH',color_name:'白色',unit:'个',
  customer_name:'样本客户',customer_phone:'13900000001',quantity:2,returned_quantity:1,remaining_quantity:1,
  unit_price:20,total_price:35,purchase_cost:null,profit:null,points_used:500,deduction_amount:5,points_awarded:0,
  operator_name:'原销售员',sale_time:'2026-11-14 10:00:00',remarks:'原单公共备注'.repeat(12),has_snapshot:1};
const rows=Array.from({length:21},(_,index)=>({...first,id:51+index,sale_no:'AS-ORIGINAL-'+(51+index),
  name:index===20?'末页商品':index===1?'原赠膜':index===3||index===4?'多接口快充数据线兼容手机平板电脑旅行装':index?'其他商品'+index:first.name,
  sale_type:index===1?'gift':'sale',unit_price:index===1?0:20,total_price:index===1?0:35,
  customer_id:9,customer_created_at:'2026-11-25',
  sale_time:index<2?'2026-11-26 10:00:00':index===2?'2026-11-25 10:00:00':first.sale_time,
  points_used:index===1?0:500,deduction_amount:index===1?0:5}));
const history={id:31,operation_type:'goods_return',quantity:1,serial_numbers:['ORIGINAL-SN-01'],
  replacement:null,replacement_amount:0,exchange_credit_amount:0,gift_charge_quantity:0,gift_charge_amount:0,
  return_reason:'原单退货',base_refund_amount:17.5,points_recovery_amount:0,points_compensation_amount:0,
  refund_amount:17.5,collection_amount:0,settlement_offset_amount:0,points_delta:250,points_award_returned:0,points_redemption_returned:250,
  store_id:2,store_name:'二店',operator_id:7,operator_name:'售后办理员',settlement_method:'cash',settlement_channel:null,
  business_time:'2026-11-14 11:00:00',created_at:'2026-11-14 11:01:00',remarks:'独立售后备注'};
const paginate=(data,page,size)=>({data:data.slice((page-1)*size,page*size),pagination:{page,page_size:size,total:data.length,
  total_pages:Math.ceil(data.length/size),has_next:page<Math.ceil(data.length/size),has_prev:page>1}});
window.fixture.denied.push('query:exchange','query:return-to-stock','accessories:view','accessories:create','accessories:gift');
window.fixture.editable=scenario==='phone-query';
const queryPhone={id:11,phone_id:11,brand:'苹果',model:'查询手机甲',model_id:1,color:'黑色',memory:'128G',is_new:1,
  status:'已售',status_code:'sold',imei:'012345678901234',serial_number:'PHONE-QUERY-11',purchase_cost:80,sale_price:100,
  customer_id:9,customer_name:'样本客户',customer_phone:'13900000001',store_id:1,store_name:'一店',supplier_name:'手机供应商',
  sale_id:81,invoice_number:'PHONE-ORIGINAL-81',has_checkout_order:false,remarks:'查询手机完整备注',
  inventory_time:'2026-11-13 09:00:00',sale_time:'2026-11-14 10:00:00'};
const saleRead=window.mockRead,salePost=window.mockPost;
window.mockPost=async(url,data)=>{
  if(scenario!=='goods-sale')throw Error('只读商品查询不得提交交易');
  const result=await salePost(url.replace('/query/goods/checkout','/sales/checkout'),data);
  if(url==='/query/goods/checkout'){
    window.fixture.success.push(result.data);
    rows.unshift({...first,id:99,name:'本次新售充电器',quantity:1,returned_quantity:0,remaining_quantity:1});
  }
  return result;
};
window.mockRead=async(url,config={})=>{
  if(url==='/query/goods/checkout/customer-summary')return saleRead('/sales/checkout/customer-summary',config);
  if(url==='/query/comprehensive')return {success:true,data:scenario==='phone-query'?[queryPhone]:[],pagination:{total:scenario==='phone-query'?1:0}};
  if(url==='/query/statistics')return {success:true,data:{
    total_phones:68,in_stock_count:12,in_stock_new_count:8,in_stock_used_count:4,sold_count:9,
    peer_transfer_count:42,supplier_proxy_count:7,new_count:6,used_count:3
  }};
  if(scenario==='phone-query'){
    window.fixture.reads.push({url,params:JSON.parse(JSON.stringify(config.params||{}))});
    if(url==='/phones/11/images'||url==='/query/sales/81/accessories')return {success:true,data:[]};
    if(url==='/query/phone/11')return {success:true,data:queryPhone};
    if(url==='/query/customers/9/film-services')return {success:true,data:{customer_id:9,eligible_for_free:true,
      device:{phone_id:11,model_id:1,model_name:'查询手机甲'},device_service_count:0,device_film_quantity:0,service_count:0,film_quantity:0,
      data:[],pagination:{page:1,page_size:20,total:0}}};
    throw Error('未登记的手机查询隔离读取：'+url);
  }
  if(url==='/query/goods/sale-options')return saleRead('/accessories/sale-options',config);
  const params=config.params||{};
  window.fixture.reads.push({url,params:JSON.parse(JSON.stringify(params)),useCache:config.useCache});
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseRead=done)}
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离读取失败')}
  if(url==='/query/goods'){
    const filtered=rows.filter(row=>(!params.keyword||[row.name,row.customer_phone,row.product_model].some(value=>value.includes(params.keyword)))&&
      (!params.sale_type||row.sale_type===params.sale_type)&&(!params.store_id||row.store_id===params.store_id));
    const summary=Object.fromEntries(['sale','gift'].map(type=>[type,Object.fromEntries(
      Object.entries({month:'2026-11',today:'2026-11-26',yesterday:'2026-11-25'}).map(([period,date])=>{
        const matches=filtered.filter(row=>row.sale_type===type&&row.sale_time.startsWith(date));
        return [period,{period_quantity:matches.reduce((total,row)=>total+row.quantity,0),
          period_amount:matches.reduce((total,row)=>total+(type==='gift'?row.quantity*20:row.total_price),0)}];
      }))]));
    const customer_visits=Object.fromEntries(Object.entries({today:'2026-11-26',yesterday:'2026-11-25'}).map(([period,date])=>{
      const customers=filtered.filter(row=>row.customer_id&&row.sale_time.startsWith(date));
      return [period,{new_count:new Set(customers.filter(row=>row.customer_created_at===date).map(row=>row.customer_id)).size,
        existing_count:new Set(customers.filter(row=>row.customer_created_at<date).map(row=>row.customer_id)).size}];
    }));
    const quantities=new Map();
    for(const row of filtered.filter(row=>row.sale_type==='sale'&&row.sale_time.startsWith('2026-11'))){
      quantities.set(row.name,(quantities.get(row.name)||0)+row.quantity);
    }
    const monthly_best_sellers=[...quantities].map(([name,quantity])=>({name,quantity}))
      .sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name,'zh-CN')).slice(0,3);
    return {success:true,data:{...paginate(filtered,params.page,params.page_size),summary,customer_visits,monthly_best_sellers}};
  }
  if(url.endsWith('/aftersales'))return {success:true,data:paginate([history],params.page,params.page_size)};
  if(scenario==='goods-sale'&&url.endsWith('/order'))return saleRead(url,config);
  if(url.endsWith('/order'))return {success:true,data:{id:10,order_no:'SO-ORIGINAL-10',customer_name:first.customer_name,
    customer_phone:first.customer_phone,store_name:first.store_name,operator_name:first.operator_name,sale_time:first.sale_time,
    remarks:first.remarks,total_amount:40,final_amount:35,paid_amount:35,deduction_amount:5,points_used:500,points_awarded:0,
    items:[{id:101,item_type:'accessory',sale_no:first.sale_no,linked_phone_sale_no:first.linked_phone_invoice,sale_type:'sale',
      name:first.name,brand_name:first.brand_name,product_model:first.product_model,color_name:first.color_name,memory:null,imei:null,
      serial_numbers:['ORIGINAL-SN-01','ORIGINAL-SN-02'],unit:'个',quantity:2,unit_price:20,gross_amount:40,total_amount:35,
      points_used:500,deduction_amount:5,points_awarded:0,gift_return_unit_price:null,gift_return_total:null,gift_agreement_state:null}]}};
  const row=rows.find(row=>url==='/query/goods/'+row.id);
  if(row)return {success:true,data:{...row,serial_numbers:['ORIGINAL-SN-01','ORIGINAL-SN-02'],batches:[{id:9,batch_no:'IN-ORIGINAL-9',
    supplier_name:'原采购供应商',quantity:2,purchase_cost:null,usage_type:'sale',inventory_operator_name:'原入库员',inventory_time:'2026-11-13 10:00:00'}]}};
  throw Error('未登记的商品查询隔离读取：'+url);
};
const Query=['goods-sale','phone-query'].includes(scenario)?(await import('/src/views/query/QueryView.vue')).default:null;
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/query',component:Query||Panel}]});
await router.push(scenario==='goods-sale'?'/query?mode=goods&openSale=true':'/query');await router.isReady();
window.fixtureRouter=router;
const app=createApp({render:()=>Query?h(RouterView):h('div',{class:'admin-page'},[h(RouterView)])});
app.use(router);
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,RecordDescriptions,DataEmptyState,TableLoadingRow,Pagination,DateRangePicker,IconRenderer,SearchActionButton,
  AmountInput,PaymentMethodSelect,PaymentChannelSelect,InlineLoading}))app.component(name,component);
app.config.globalProperties.$getNumberColumnWidth=getNumberColumnMinWidth;
app.directive('permission',{});app.directive('identifier-input',vIdentifierInput);app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);
app.mount('#app');
if(Query)initScrollAnimations();
`

export async function verifyQueryPhone(page, capture = async () => {}) {
  await page.waitForSelector('.devices-table .el-table__row')
  assert.equal(await page.$eval('.query-list-header .record-count', count => count.textContent.trim()), '共 1 条')
  const readCard = async label => {
    await page.waitForFunction(label => [...document.querySelectorAll('.stats-cards .stat-card')]
      .some(card => card.querySelector('.stat-label')?.textContent.trim() === label), {}, label)
    return page.$$eval('.stats-cards .stat-card', (cards, label) => {
      const card = cards.find(item => item.querySelector('.stat-label')?.textContent.trim() === label)
      if (!card) throw new Error(`找不到统计卡片：${label}`)
      return {
        label: card.querySelector('.stat-label').textContent.trim(),
        total: card.querySelector('.stat-value').textContent.trim(),
        details: [...card.querySelectorAll('dt')].map((item, index) => [item.textContent.trim(), card.querySelectorAll('dd')[index].textContent.trim()]),
        layout: [card.querySelector('.stat-content'), card.querySelector('.stat-card__details')].map(element => {
          if (!element) return null
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, top: rect.top }
        })
      }
    }, label)
  }
  const inStock = await readCard('在库数量')
  assert.deepEqual(inStock.label, '在库数量')
  assert.equal(inStock.total, '12台')
  assert.deepEqual(inStock.details, [['全新', '8台'], ['二手', '4台']])
  assert.ok(inStock.layout[1].left >= inStock.layout[0].right, '分项应展示在主数量右侧')
  await page.evaluate(() => { window.fixture.hidden.push('stats.in_stock_count') })
  await page.waitForFunction(() => ![...document.querySelectorAll('.stats-cards .stat-card')]
    .some(card => card.querySelector('.stat-label')?.textContent.trim() === '在库数量'))
  await page.evaluate(() => { window.fixture.hidden.pop() })
  await readCard('在库数量')
  const sold = await readCard('已售数量')
  const newSold = await readCard('全新已售')
  const usedSold = await readCard('二手已售')
  assert.equal(sold.total, '9台')
  assert.equal(newSold.total, '6台')
  assert.equal(usedSold.total, '3台')
  assert.equal(Number(newSold.total.replace('台', '')) + Number(usedSold.total.replace('台', '')),
    Number(sold.total.replace('台', '')), '已售总数等于全新和二手已售数量之和')
  const transfer = await readCard('调货划拨')
  const transferSummary = [transfer.label, transfer.total, transfer.details.map(item => item[0]), transfer.details.map(item => item[1])]
  assert.deepEqual(transferSummary, ['调货划拨', '49台', ['调货', '划拨'], ['42台', '7台']])
  await page.evaluate(() => { window.fixture.hidden.push('stats.transfer_counts') })
  await page.waitForFunction(() => ![...document.querySelectorAll('.stats-cards .stat-card')]
    .some(card => card.querySelector('.stat-label')?.textContent.trim() === '调货划拨'))
  await page.evaluate(() => { window.fixture.hidden.pop() })
  await readCard('调货划拨')
  const visibleDialogs = () => page.$$eval('.el-dialog', elements => elements.filter(element => element.checkVisibility()).length)
  const closeTop = async () => {
    const count = await visibleDialogs()
    const buttons = await page.$$('.el-dialog__headerbtn')
    const visible = []
    for (const button of buttons) if (await button.isVisible()) visible.push(button)
    assert.ok(visible.length, '应使用公共弹窗关闭按钮')
    await clickVisible(visible.at(-1))
    await page.waitForFunction(count => [...document.querySelectorAll('.el-dialog')].filter(element => element.checkVisibility()).length === count - 1, {}, count)
  }
  const cell = async label => {
    const index = await page.$$eval('.devices-table .el-table__header-wrapper th', (elements, label) => elements.findIndex(element => element.textContent.trim() === label), label)
    assert.ok(index >= 0, `应显示${label}字段`)
    return (await page.$$('.devices-table .el-table__row:first-child td'))[index]
  }
  const modelCell = await cell('型号')
  if (page.viewport().width <= 1024) {
    await modelCell.scrollIntoView()
    await modelCell.tap()
    await modelCell.tap()
  } else await clickVisible(modelCell, { count: 2 })
  await page.waitForSelector('.query-detail-dialog .query-detail-content')
  assert.equal(await visibleDialogs(), 1, '普通字段双击只打开设备详情')
  await checkBoundaries(page)
  await capture()
  await clickButton(page, '贴膜')
  await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog__title')].some(element => element.checkVisibility() && element.textContent === '客户贴膜'))
  await page.waitForFunction(() => document.body.textContent.includes('本机累计贴膜') && document.body.textContent.includes('查询手机甲'))
  const filmReads = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.reads.filter(row => row.url === '/query/customers/9/film-services'))))
  assert.ok(filmReads.some(row => row.params.phone_id === 11), '贴膜须关联当前真实手机')
  assert.equal(await page.$eval('.query-detail-dialog', element => element.checkVisibility()), true, '贴膜沿用当前设备详情')
  await checkBoundaries(page)
  await closeTop()
  await closeTop()
  if (page.viewport().width > 1024) {
    await clickVisible(await cell('IMEI'), { count: 2 })
    await page.waitForSelector('.query-detail-dialog .query-detail-content')
    await closeTop()
    const status = await (await cell('状态')).$('.status-cell')
    await clickVisible(status, { count: 2 })
    await page.waitForSelector('.sales-receipt-dialog')
    assert.equal(await page.$('.query-detail-dialog'), null, '状态仍打开销售凭证，不叠加设备详情')
    await closeTop()
    await clickVisible(await (await cell('成色')).$('.clickable-cell'), { count: 2 })
    await page.waitForFunction(() => document.body.textContent.includes('暂无图片或视频'))
    assert.equal(await page.$('.query-detail-dialog'), null, '成色仍打开素材，不叠加设备详情')
    await closeTop()
    await clickVisible(await (await cell('备注')).$('.remark-cell'), { count: 2 })
    await page.waitForSelector('.query-remark-message-box')
    assert.equal(await page.$('.query-detail-dialog'), null, '备注仍独立查看完整原文')
    await clickButton(page, '关闭')
    await page.waitForFunction(() => !document.querySelector('.query-remark-message-box')?.checkVisibility())
    await clickVisible(await page.$('.devices-table .actions-cell button[title="编辑"]'), { count: 2 })
    await page.waitForSelector('.query-edit-dialog')
    assert.equal(await page.$('.query-detail-dialog'), null, '操作按钮只执行编辑，不叠加设备详情')
    await closeTop()
  }
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts))), [], '查看及进入贴膜不能提交交易')
}

async function search(page, value) {
  const input = await page.$('input[aria-label="商品销售关键词"]')
  await clickVisible(input)
  await input.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  if (value) await input.type(value)
  await clickButton(page, '搜索')
  await page.waitForFunction(value => window.fixture.reads.at(-1)?.params.keyword === (value || undefined) &&
    !document.querySelector('.unified-search-panel__search-button').classList.contains('is-loading'), {}, value)
}

async function filter(page, label, optionText) {
  const input = await page.$(`input[aria-label="${label}"]`)
  if (!await input.isVisible()) {
    const panel = await page.$('.unified-search-panel')
    await clickVisible(panel, { offset: { x: 4, y: 4 } })
    await page.waitForFunction(() => document.querySelector('.unified-search-panel__form').classList.contains('is-expanded'))
  }
  await clickVisible(await page.$(`.el-select:has(input[aria-label="${label}"])`))
  const id = await input.evaluate(element => element.getAttribute('aria-controls'))
  await page.waitForSelector(`#${id} .el-select-dropdown__item`, { visible: true })
  for (const option of await page.$$(`#${id} .el-select-dropdown__item`)) {
    if (await option.evaluate((element, text) => element.textContent.trim() === text, optionText)) {
      await clickVisible(option)
      await page.waitForFunction(element => element.getAttribute('aria-expanded') === 'false', {}, input)
      return
    }
  }
  assert.fail(`没有找到筛选项 ${optionText}`)
}

async function openDetail(page) {
  const row = await page.waitForSelector('.admin-data-table .el-table__body tr.el-table__row', { visible: true })
  if (await page.evaluate(() => innerWidth <= 1024)) {
    const cell = await row.$('td')
    await cell.scrollIntoView()
    await cell.tap()
    await cell.tap()
  } else await clickVisible(await row.waitForSelector('button', { visible: true }))
  await page.waitForFunction(() => document.body.textContent.includes('原始凭据') && document.body.textContent.includes('独立售后备注')).catch(async error => {
    const state = await page.evaluate(() => ({ text: document.body.textContent.slice(-2500), reads: JSON.parse(JSON.stringify(window.fixture.reads.slice(-4))) }))
    throw new Error(`商品详情未完成：${JSON.stringify(state)}`, { cause: error })
  })
}

async function closeDialog(page) {
  const buttons = await page.$$('button[aria-label="Close this dialog"], button[aria-label="关闭"]')
  const visible = []
  for (const button of buttons) if (await button.isVisible()) visible.push(button)
  assert.ok(visible.length, '应有公共顶部关闭按钮')
  await clickVisible(visible.at(-1))
  await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog, .mobile-dialog-sheet')].every(element => !element.checkVisibility()))
}

export async function verifyQueryGoods(page, capture = async () => {}) {
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器') && document.body.textContent.includes('原赠膜'))
  const stats = '[aria-label="商品查询统计"]'
  const values = () => page.$$eval(`${stats} .stat-value`, items => items.map(item => item.textContent.replace(/\s/g, '')))
  const allValues = ['¥700', '¥40']
  assert.deepEqual(await values(), allValues)
  const dayValues = () => page.$$eval(`${stats} .stat-card__details--amount-divider > div`, items => items.map(item => item.innerText.replace(/\s/g, '')))
  const rankedValues = () => page.$$eval(`${stats} .stat-card__details--ranked > div`, items => items.map(item => item.innerText.replace(/\s/g, '')))
  const ranking = await rankedValues()
  assert.equal(ranking.length, 3)
  assert.equal(ranking[0], '多接口快充数据线兼容手机平板电脑旅行装4件')
  assert.ok(ranking.slice(1).every(value => value.endsWith('2件') && !value.includes('原赠膜')))
  const visitValues = ['今日新客户0人老客户1人', '昨日新客户1人老客户0人']
  assert.deepEqual(await dayValues(), ['今日销售2件¥35', '昨日销售2件¥35', '今日赠送2件¥40', '昨日赠送0件¥0', ...visitValues])
  const layout = await page.$eval(stats, group => {
    const bounds = group.getBoundingClientRect()
    const cards = [...group.children].map(card => card.getBoundingClientRect())
    const content = group.parentElement
    const search = content.querySelector('.unified-search-panel').getBoundingClientRect()
    const table = content.querySelector('.admin-table-panel').getBoundingClientRect()
    return {
      rows: new Set(cards.map(card => card.top)).size,
      expectedRows: innerWidth <= 767 ? 2 : 1,
      fits: cards.every(card => card.left >= bounds.left - 1 && card.right <= bounds.right + 1),
      rankedFits: [...group.querySelectorAll('.stat-card__details--ranked dt')].every(label => {
        const card = label.closest('.stat-card').getBoundingClientRect()
        const quantity = label.nextElementSibling.getBoundingClientRect()
        return getComputedStyle(label).borderInlineEndStyle === 'dashed' && getComputedStyle(label).textOverflow === 'ellipsis' &&
          label.clientWidth > 0 && quantity.right <= card.right
      }),
      dividers: [...group.querySelectorAll('.stat-card__details--amount-divider')].every(details => {
        const amounts = [...details.querySelectorAll('.stat-card__detail-amount')]
        return amounts.length === 2 && amounts.every(amount => getComputedStyle(amount).borderInlineStartStyle === 'dashed') &&
          Math.abs(amounts[0].getBoundingClientRect().left - amounts[1].getBoundingClientRect().left) <= 1
      }),
      edgeOffsets: [Math.min(...cards.map(card => card.left)) - search.left,
        Math.max(...cards.map(card => card.right)) - search.right, table.left - search.left, table.right - search.right]
    }
  })
  assert.equal(layout.rows, layout.expectedRows)
  assert.equal(layout.fits, true)
  assert.equal(layout.rankedFits, true)
  assert.equal(layout.dividers, true, '同张卡片的今日和昨日金额分隔线对齐')
  assert.ok(layout.edgeOffsets.every(offset => Math.abs(offset) <= 1), `统计、检索和表格左右对齐，偏差 ${layout.edgeOffsets.join(', ')}px`)
  assert.equal(await page.$eval('.admin-table-panel .section-title .section-title__label', title => title.textContent.trim()), '商品销售列表')
  assert.equal(await page.$eval('.admin-table-panel .section-title .record-count', count => count.textContent.trim()), '共 21 条')
  await checkBoundaries(page)
  assert.equal(await page.evaluate(() => document.body.textContent.includes('¥NaN')), false)
  await clickVisible(await page.$('.tf-pagination__btn--next'))
  await page.waitForFunction(() => document.querySelector('.admin-data-table').textContent.includes('末页商品') &&
    !document.querySelector('.admin-data-table').textContent.includes('原单充电器'))
  assert.deepEqual(await values(), allValues, '翻页保持全部匹配记录的统计')
  assert.deepEqual((await dayValues()).slice(-2), visitValues)
  assert.deepEqual(await rankedValues(), ranking)
  await search(page, '原单充电器')
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器') && !document.body.textContent.includes('末页商品'))
  assert.deepEqual(await values(), ['¥35', '¥0'])
  assert.deepEqual(await rankedValues(), ['原单充电器2件'])
  assert.equal(await page.evaluate(() => window.fixture.reads.at(-1).params.page), 1)
  await clickButton(page, '重置')
  await filter(page, '出库类型', '赠送')
  await page.waitForFunction(() => document.body.textContent.includes('原赠膜') && !document.body.textContent.includes('原单充电器'))
  assert.deepEqual(await values(), ['¥0', '¥40'])
  assert.deepEqual(await rankedValues(), [])
  assert.equal(await page.$eval(stats, group => group.textContent.includes('暂无热销商品')), true)
  await filter(page, '销售门店', '二店')
  await page.waitForFunction(() => document.body.textContent.includes('暂无商品销售或赠送记录'))
  assert.deepEqual(await values(), ['¥0', '¥0'])
  assert.deepEqual((await dayValues()).slice(-2), ['今日新客户0人老客户0人', '昨日新客户0人老客户0人'])
  await checkBoundaries(page)
  await clickButton(page, '重置')
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器'))
  await page.evaluate(() => { window.fixture.hidden.push('stock_info.total_quantity') })
  await page.waitForFunction(selector => document.querySelectorAll(`${selector} .stat-card`).length === 1, {}, stats)
  assert.deepEqual(await values(), [])
  assert.deepEqual(await dayValues(), visitValues)
  await page.evaluate(() => { window.fixture.hidden = [] })
  await page.waitForFunction(selector => document.querySelectorAll(`${selector} .stat-card`).length === 4, {}, stats)
  await openDetail(page)
  if (await page.evaluate(() => innerWidth < 768)) {
    const grids = await page.$$eval('.goods-detail__compact-grid--product, .goods-detail__compact-grid--customer', grids =>
      grids.map(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length))
    assert.deepEqual(grids, [2, 2], '手机详情的客户和商品资料各用两列')
  }
  await capture()
  for (const text of ['原采购供应商', 'IN-ORIGINAL-9', 'ORIGINAL-SN-02', '原实付应退', '独立售后备注']) {
    assert.equal(await page.evaluate(text => document.body.textContent.includes(text), text), true, text)
  }
  await checkBoundaries(page)
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.goods-detail__compact-field strong, .el-descriptions__content')].filter(element => {
    const rect = element.getBoundingClientRect()
    return rect.width && (rect.left < 0 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)
  }).map(element => element.textContent))
  assert.deepEqual(clipped, [], '商品详情长字段不能溢出或被截断')
  await page.evaluate(() => { window.fixture.hidden.push('customer_info.customer_phone', 'basic_info.serial_number') })
  await page.waitForFunction(() => !document.body.textContent.includes('13900000001') && !document.body.textContent.includes('ORIGINAL-SN-01'))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('来访客户')), true)
  await page.evaluate(() => { window.fixture.hidden = [] })
  await page.waitForFunction(() => document.body.textContent.includes('13900000001') && document.body.textContent.includes('ORIGINAL-SN-01'))
  await clickButton(page, '整单明细')
  await page.waitForFunction(() => document.body.textContent.includes('本单现金入账') && document.body.textContent.includes('SO-ORIGINAL-10') && document.body.textContent.includes('¥35')).catch(async error => {
    const state = await page.evaluate(() => ({ text: document.body.textContent.slice(-2500), reads: JSON.parse(JSON.stringify(window.fixture.reads.slice(-4))) }))
    throw new Error(`整单明细未完成：${JSON.stringify(state)}`, { cause: error })
  })
  await checkBoundaries(page)
  await closeDialog(page)

  await page.evaluate(() => { window.fixture.failNext = true })
  await clickButton(page, '搜索')
  await page.waitForFunction(() => document.body.textContent.includes('商品销售记录读取失败'))
  assert.deepEqual(await values(), [])
  await clickButton(page, '搜索')
  await page.waitForFunction(() => !document.body.textContent.includes('商品销售记录读取失败'))
  await openDetail(page)
  await page.evaluate(() => { window.fixture.denied.push('query:goods-view') })
  await page.waitForFunction(() => !document.body.textContent.includes('原单充电器') && !document.body.textContent.includes('独立售后备注'))
  assert.deepEqual(await values(), [])
  const count = await page.evaluate(() => window.fixture.reads.length)
  await clickButton(page, '搜索')
  assert.equal(await page.evaluate(() => window.fixture.reads.length), count, '撤回查看权限不得继续读取')
  await page.evaluate(() => { window.fixture.denied = window.fixture.denied.filter(value => value !== 'query:goods-view') })
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器'))
  await page.evaluate(() => { window.fixture.holdNext = true })
  await clickButton(page, '搜索')
  await page.waitForFunction(() => typeof window.releaseRead === 'function')
  await page.evaluate(() => { window.fixture.denied.push('query:view'); window.releaseRead() })
  await page.waitForFunction(() => !document.body.textContent.includes('原单充电器'))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('原单充电器')), false, '撤权后的迟到响应不得恢复原记录')
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts))), [])
  assert.equal(await page.evaluate(() => window.fixture.reads.every(row => row.useCache === false)), true)
}

async function waitSaleDialog(page) {
  await page.waitForSelector('.cashier-workspace', { visible: true })
}

async function checkQueryModeTabs(page, title, activeMode) {
  const modes = await page.$$eval('[aria-label="查询模式"]', groups => groups.filter(group => group.checkVisibility()).map(group => {
    const header = group.closest('.admin-table-panel .section-title')
    const label = header?.querySelector('.section-title__label')
    if (!header || !label) return { title: null }
    const bounds = header?.getBoundingClientRect()
    const tabs = group.getBoundingClientRect()
    const style = getComputedStyle(group)
    const compact = innerWidth <= 767
    return {
      title: label?.textContent.trim(),
      active: group.querySelector('[aria-pressed="true"]')?.textContent.trim(),
      fits: Boolean(bounds && tabs.left >= bounds.left - 1 && tabs.right <= bounds.right + 1 && group.scrollWidth <= group.clientWidth + 1),
      frameRemoved: style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderWidth === '0px' && style.boxShadow === 'none',
      beside: compact || Math.abs(label.getBoundingClientRect().y + label.getBoundingClientRect().height / 2 - tabs.y - tabs.height / 2) <= 1,
      sizing: style.paddingTop === (compact ? '2px' : '4px') && style.paddingLeft === style.paddingTop &&
        [...group.querySelectorAll('button')].every(button => {
          const size = getComputedStyle(button)
          return size.height === '28px' && size.paddingLeft === (compact ? '6px' : '10px') && size.paddingRight === size.paddingLeft
        })
    }
  }))
  assert.deepEqual(modes, [{ title, active: activeMode, fits: true, frameRemoved: true, beside: true, sizing: true }])
}

async function checkQueryModeTabSwipe(page) {
  const tabs = await page.waitForSelector('[aria-label="查询模式"]:has([aria-pressed="true"][class*="primary"])', { visible: true })
  await tabs.scrollIntoView()
  const bounds = await tabs.evaluate(group => {
    for (let index = 1; index <= 16 && group.scrollWidth - group.clientWidth <= 12; index++) {
      const tab = group.querySelector('button').cloneNode(true)
      tab.textContent = `附加查询 ${index}`
      tab.dataset.fixtureTab = ''
      group.append(tab)
    }
    const { x, y, width, height } = group.getBoundingClientRect()
    return { x, y: y + height / 2, width, overflow: group.scrollWidth - group.clientWidth }
  })
  try {
    assert.ok(bounds.overflow > 0, '窄屏上多余页签应在栏内溢出')
    const touch = await page.touchscreen.touchStart(bounds.x + bounds.width * 0.88, bounds.y)
    for (const position of [0.65, 0.40, 0.12]) await touch.move(bounds.x + bounds.width * position, bounds.y)
    await touch.end()
    await page.waitForFunction(group => group.scrollLeft > 0, {}, tabs)
    await page.waitForFunction(group => group.lastElementChild.getBoundingClientRect().right <= group.getBoundingClientRect().right + 1, {}, tabs)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
  } finally {
    await tabs.evaluate(group => {
      group.querySelectorAll('[data-fixture-tab]').forEach(tab => tab.remove())
      group.scrollLeft = 0
    })
    await tabs.dispose()
  }
}

export async function verifyQueryGoodsSale(page, capture = async () => {}) {
  await waitSaleDialog(page)
  await page.waitForFunction(() => window.fixtureRouter.currentRoute.value.query.openSale===undefined)
  assert.equal(await page.evaluate(() => window.fixtureRouter.currentRoute.value.query.mode), 'goods', '快捷入口先进入商品模式并消费弹窗参数')
  assert.equal(await page.evaluate(() => window.fixture.posts.length), 0, '快捷打开收银不提交交易')
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods'))
  await checkQueryModeTabs(page, '商品销售列表', '商品销售')
  if (page.viewport().width < 768) await checkQueryModeTabSwipe(page)
  await clickButton(page, '综合查询')
  await checkQueryModeTabs(page, '综合销售列表', '综合查询')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.page-header button')].some(element => element.checkVisibility() && element.textContent.trim() === '商品开单')), false, '综合查询页签隐藏商品开单入口')
  await clickButton(page, '商品销售')
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器'))
  await checkQueryModeTabs(page, '商品销售列表', '商品销售')
  await clickVisible(await page.$('.tf-pagination__btn--next'))
  await page.waitForFunction(() => document.querySelector('.admin-data-table')?.textContent.includes('末页商品'))
  const countGoodsReads = () => page.evaluate(() => window.fixture.reads.filter(read => read.url === '/query/goods').length)
  const readsBeforeSwitch = await countGoodsReads()
  const stats = '[aria-label="商品查询统计"]'
  await page.waitForSelector(stats, { visible: true })
  await clickButton(page, '综合查询')
  await page.waitForSelector(stats, { hidden: true })
  await clickButton(page, '商品销售')
  await page.waitForSelector(stats, { visible: true, timeout: 2000 })
  assert.equal(await countGoodsReads(), readsBeforeSwitch, '返回商品模式保留统计与列表，不重发查询')
  assert.ok(await page.$eval('.admin-data-table', table => table.textContent.includes('末页商品')), '返回商品模式保留页码')
  await clickButton(page, '刷新')
  await page.waitForFunction(count => window.fixture.reads.filter(read => read.url === '/query/goods').length === count + 1 &&
    document.querySelector('[aria-label="商品查询统计"]')?.getAttribute('aria-busy') === 'false', {}, readsBeforeSwitch)
  const initial = await page.evaluate(() => window.fixture.reads.length)
  await clickButton(page, '商品开单')
  await waitSaleDialog(page)
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods'))
  assert.equal(await page.evaluate(() => window.fixture.reads.length), initial, '取消商品销售不刷新或更改查询页码')
  assert.equal(await page.evaluate(() => window.fixture.posts.length), 0)
  await clickButton(page, '商品开单')
  await waitSaleDialog(page)
  await select(page, '销售门店', '一店')
  await page.waitForFunction(() => [...document.querySelectorAll('.cashier-product button')].some(element => element.textContent.trim() === '原装充电器'))
  await clickButton(page, '原装充电器')
  await clickButton(page, '加入清单')
  await checkBoundaries(page)
  await capture()
  await clickButton(page, '确认结算')
  await input(page, '手机号', '13900000001')
  await clickVisible(await page.waitForSelector('.customer-search-dropdown__item'))
  await select(page, '支付方式', '现金')
  await checkBoundaries(page)
  await capture()
  await clickButton(page, '确认收款')
  await page.waitForFunction(() => window.fixture.success.length === 1 && document.body.textContent.includes('收款成功') && document.body.textContent.includes('本次新售充电器'))
  await capture()
  await clickButton(page, '完成')
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods'))
  const result = await page.evaluate(() => JSON.parse(JSON.stringify({ posts: window.fixture.posts, last: window.fixture.reads.at(-1) })))
  assert.equal(result.posts.length, 1)
  assert.equal(result.posts[0].url, '/sales/checkout')
  assert.deepEqual(result.posts[0].data.phones, [], '独立商品销售不携带手机')
  assert.equal(result.posts[0].data.accessories[0].accessory_id, 56)
  assert.equal(result.last.url, '/query/goods')
  assert.equal(result.last.params.page, 1, '成功回第一页查看新成交')
  assert.equal(result.last.useCache, false)
  await page.evaluate(() => window.fixture.denied.push('query:goods-sell'))
  await clickButton(page, '商品开单')
  await waitSaleDialog(page)
  await select(page, '销售门店', '一店')
  await page.waitForFunction(() => [...document.querySelectorAll('.cashier-product button')].some(element => element.textContent.trim() === '赠膜'))
  await clickButton(page, '赠膜')
  await clickButton(page, '加入清单')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.el-form .el-select')].some(element => element.textContent.trim() === '赠送')), true, '仅赠送权限仍可打开赠送开单')
  await page.evaluate(() => window.fixture.denied.push('query:goods-gift'))
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods') && ![...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '商品开单'))
  assert.equal(await page.evaluate(() => window.fixture.posts.length), 1, '撤回全部商品动作后关闭开单且不提交')
  await page.evaluate(() => { window.fixture.denied = window.fixture.denied.filter(permission => !['query:goods-sell', 'query:goods-gift'].includes(permission)) })
  await clickButton(page, '商品开单')
  await waitSaleDialog(page)
  await clickButton(page, '取消')
  await clickButton(page, '综合查询')
  await page.waitForFunction(() => ![...document.querySelectorAll('.page-header button')].some(element => element.checkVisibility() && element.textContent.trim() === '商品开单'))
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('.checkout-additional-goods'))), false, '切回综合查询关闭商品销售草稿')
  const readsBeforeRevoke = await countGoodsReads()
  await page.evaluate(() => { window.fixture.denied.push('query:goods-view') })
  await page.waitForFunction(() => !document.querySelector('[aria-label="商品查询统计"]'))
  assert.equal(await countGoodsReads(), readsBeforeRevoke, '撤权时不请求商品记录')
}
