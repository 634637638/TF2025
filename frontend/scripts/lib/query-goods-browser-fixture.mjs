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
  name:index===20?'末页商品':index===1?'原赠膜':index?'其他商品'+index:first.name,
  sale_type:index===1?'gift':'sale',unit_price:index===1?0:20,total_price:index===1?0:35,
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
  if(url==='/query/statistics')return {success:true,data:{}};
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
    return {success:true,data:paginate(filtered,params.page,params.page_size)};
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
const app=createApp({render:()=>h(RouterView)});
app.use(router);
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,RecordDescriptions,DataEmptyState,TableLoadingRow,Pagination,DateRangePicker,IconRenderer,
  AmountInput,PaymentMethodSelect,PaymentChannelSelect,InlineLoading}))app.component(name,component);
app.config.globalProperties.$getNumberColumnWidth=getNumberColumnMinWidth;
app.directive('permission',{});app.directive('identifier-input',vIdentifierInput);app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);
app.mount('#app');
if(Query)initScrollAnimations();
`

export async function verifyQueryPhone(page, capture = async () => {}) {
  await page.waitForSelector('.devices-table .el-table__row')
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
  await page.waitForFunction(() => document.body.textContent.includes('销售时资料') && document.body.textContent.includes('独立售后备注')).catch(async error => {
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
  await checkBoundaries(page)
  assert.equal(await page.evaluate(() => document.body.textContent.includes('¥NaN')), false)
  await clickVisible(await page.$('.tf-pagination__btn--next'))
  await page.waitForFunction(() => document.body.textContent.includes('末页商品') && !document.body.textContent.includes('原单充电器'))
  await search(page, '原单充电器')
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器') && !document.body.textContent.includes('末页商品'))
  assert.equal(await page.evaluate(() => window.fixture.reads.at(-1).params.page), 1)
  await clickButton(page, '重置')
  await filter(page, '出库类型', '赠送')
  await page.waitForFunction(() => document.body.textContent.includes('原赠膜') && !document.body.textContent.includes('原单充电器'))
  await filter(page, '销售门店', '二店')
  await page.waitForFunction(() => document.body.textContent.includes('暂无商品销售或赠送记录'))
  await checkBoundaries(page)
  await clickButton(page, '重置')
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器'))
  await openDetail(page)
  if (await page.evaluate(() => innerWidth < 768)) {
    const spans = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.el-descriptions__label')]
      .filter(element => ['商品名称', '客户手机号', '商品类型'].includes(element.textContent.trim()))
      .map(element => [element.textContent.trim(), element.getAttribute('colspan')])))
    assert.deepEqual(spans, { 商品名称: '2', 客户手机号: '2', 商品类型: '1' })
  }
  await capture()
  for (const text of ['原采购供应商', 'IN-ORIGINAL-9', 'ORIGINAL-SN-02', '原实付应退', '独立售后备注']) {
    assert.equal(await page.evaluate(text => document.body.textContent.includes(text), text), true, text)
  }
  await checkBoundaries(page)
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.el-descriptions__content')].filter(element => {
    const rect = element.getBoundingClientRect()
    return rect.width && (rect.left < 0 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)
  }).map(element => element.textContent))
  assert.deepEqual(clipped, [], '商品详情长字段不能溢出或被截断')
  await page.evaluate(() => { window.fixture.hidden.push('customer_info.customer_phone', 'basic_info.serial_number') })
  await page.waitForFunction(() => !document.body.textContent.includes('13900000001') && !document.body.textContent.includes('ORIGINAL-SN-01'))
  await page.evaluate(() => { window.fixture.hidden = [] })
  await page.waitForFunction(() => document.body.textContent.includes('13900000001') && document.body.textContent.includes('ORIGINAL-SN-01'))
  await clickButton(page, '整单明细')
  await page.waitForFunction(() => document.body.textContent.includes('本次结算的原成交记录') && document.body.textContent.includes('¥35')).catch(async error => {
    const state = await page.evaluate(() => ({ text: document.body.textContent.slice(-2500), reads: JSON.parse(JSON.stringify(window.fixture.reads.slice(-4))) }))
    throw new Error(`整单明细未完成：${JSON.stringify(state)}`, { cause: error })
  })
  await checkBoundaries(page)
  await closeDialog(page)

  await page.evaluate(() => { window.fixture.failNext = true })
  await clickButton(page, '搜索')
  await page.waitForFunction(() => document.body.textContent.includes('商品销售记录读取失败'))
  await clickButton(page, '搜索')
  await page.waitForFunction(() => !document.body.textContent.includes('商品销售记录读取失败'))
  await openDetail(page)
  await page.evaluate(() => { window.fixture.denied.push('query:goods-view') })
  await page.waitForFunction(() => !document.body.textContent.includes('原单充电器') && !document.body.textContent.includes('独立售后备注'))
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

export async function verifyQueryGoodsSale(page, capture = async () => {}) {
  await waitSaleDialog(page)
  await page.waitForFunction(() => window.fixtureRouter.currentRoute.value.query.openSale===undefined)
  assert.equal(await page.evaluate(() => window.fixtureRouter.currentRoute.value.query.mode), 'goods', '快捷入口先进入商品模式并消费弹窗参数')
  assert.equal(await page.evaluate(() => window.fixture.posts.length), 0, '快捷打开收银不提交交易')
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods'))
  await clickButton(page, '手机模式')
  await page.waitForFunction(() => document.body.textContent.includes('手机模式'))
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.page-header button')].some(element => element.checkVisibility() && element.textContent.trim() === '商品销售')), false, '手机模式不显示独立商品销售')
  await clickButton(page, '商品模式')
  await page.waitForFunction(() => document.body.textContent.includes('原单充电器'))
  await clickVisible(await page.$('.tf-pagination__btn--next'))
  await page.waitForFunction(() => document.body.textContent.includes('末页商品'))
  const initial = await page.evaluate(() => window.fixture.reads.length)
  await clickButton(page, '商品销售')
  await waitSaleDialog(page)
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods'))
  assert.equal(await page.evaluate(() => window.fixture.reads.length), initial, '取消商品销售不刷新或更改查询页码')
  assert.equal(await page.evaluate(() => window.fixture.posts.length), 0)
  await clickButton(page, '商品销售')
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
  await clickButton(page, '商品销售')
  await waitSaleDialog(page)
  await select(page, '销售门店', '一店')
  await page.waitForFunction(() => [...document.querySelectorAll('.cashier-product button')].some(element => element.textContent.trim() === '赠膜'))
  await clickButton(page, '赠膜')
  await clickButton(page, '加入清单')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.el-form .el-select')].some(element => element.textContent.trim() === '赠送')), true, '仅赠送权限仍可打开赠送开单')
  await page.evaluate(() => window.fixture.denied.push('query:goods-gift'))
  await page.waitForFunction(() => !document.querySelector('.checkout-additional-goods') && ![...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '商品销售'))
  assert.equal(await page.evaluate(() => window.fixture.posts.length), 1, '撤回全部商品动作后关闭开单且不提交')
  await page.evaluate(() => { window.fixture.denied = window.fixture.denied.filter(permission => !['query:goods-sell', 'query:goods-gift'].includes(permission)) })
  await clickButton(page, '商品销售')
  await waitSaleDialog(page)
  await clickButton(page, '取消')
  await clickButton(page, '手机模式')
  await page.waitForFunction(() => ![...document.querySelectorAll('.page-header button')].some(element => element.checkVisibility() && element.textContent.trim() === '商品销售'))
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('.checkout-additional-goods'))), false, '切回手机模式不能遗留商品销售草稿')
}
