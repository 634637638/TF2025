import assert from 'node:assert/strict'
import { salesEnvironment, clickVisible, clickButton, checkBoundaries } from './sales-checkout-browser-fixture.mjs'

// 挂载完整商品查询面板及真实子弹窗；服务仅使用本页内存，不代表综合查询手机页或真实交易验收。
export const queryGoodsEntry = `${salesEnvironment}
import {vTFLoading} from '/src/directives/index.ts';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
import {getNumberColumnMinWidth} from '/src/utils/table-layout.ts';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import TableLoadingRow from '/src/components/TableLoadingRow.vue';
import Pagination from '/src/components/Pagination.vue';
import DateRangePicker from '/src/components/DateRangePicker.vue';
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
window.fixture.denied.push('query:exchange','query:return-to-stock');
window.mockPost=async()=>{throw Error('只读商品查询不得提交交易')};
window.mockRead=async(url,config={})=>{
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
  if(url.endsWith('/order'))return {success:true,data:{id:10,order_no:'SO-ORIGINAL-10',customer_name:first.customer_name,
    customer_phone:first.customer_phone,store_name:first.store_name,operator_name:first.operator_name,sale_time:first.sale_time,
    remarks:first.remarks,total_amount:40,final_amount:35,paid_amount:35,deduction_amount:5,points_used:500,points_awarded:0,
    items:[{id:101,item_type:'accessory',sale_no:first.sale_no,linked_phone_sale_no:first.linked_phone_invoice,sale_type:'sale',
      name:first.name,brand_name:first.brand_name,product_model:first.product_model,color_name:first.color_name,memory:null,imei:null,
      serial_numbers:['ORIGINAL-SN-01','ORIGINAL-SN-02'],unit:'个',quantity:2,unit_price:20,gross_amount:40,total_amount:35,
      points_used:500,deduction_amount:5,points_awarded:0}]}};
  const row=rows.find(row=>url==='/query/goods/'+row.id);
  if(row)return {success:true,data:{...row,serial_numbers:['ORIGINAL-SN-01','ORIGINAL-SN-02'],batches:[{id:9,batch_no:'IN-ORIGINAL-9',
    supplier_name:'原采购供应商',quantity:2,purchase_cost:null,usage_type:'sale',inventory_operator_name:'原入库员',inventory_time:'2026-11-13 10:00:00'}]}};
  throw Error('未登记的商品查询隔离读取：'+url);
};
const app=createApp({render:()=>h('main',{class:'admin-page'},h(Panel))});
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,RecordDescriptions,DataEmptyState,TableLoadingRow,Pagination,DateRangePicker}))app.component(name,component);
app.config.globalProperties.$getNumberColumnWidth=getNumberColumnMinWidth;
app.directive('permission',{});app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);
app.mount('#app');
`

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
  await page.evaluate(() => { window.fixture.denied.push('accessories:view') })
  await page.waitForFunction(() => !document.body.textContent.includes('原单充电器') && !document.body.textContent.includes('独立售后备注'))
  const count = await page.evaluate(() => window.fixture.reads.length)
  await clickButton(page, '搜索')
  assert.equal(await page.evaluate(() => window.fixture.reads.length), count, '撤回查看权限不得继续读取')
  await page.evaluate(() => { window.fixture.denied = window.fixture.denied.filter(value => value !== 'accessories:view') })
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
