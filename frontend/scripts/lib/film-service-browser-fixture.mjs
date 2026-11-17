import assert from 'node:assert/strict'
import { salesEnvironment, button, clickButton, clickVisible, field, input, select, checkBoundaries } from './sales-checkout-browser-fixture.mjs'

// 真实组件与键鼠操作；仅内存服务替身，全部业务网络访问拒绝。
export const filmServiceEntry = `${salesEnvironment}
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import Pagination from '/src/components/Pagination.vue';
import {vTFLoading} from '/src/directives/index.ts';
const {default:Film}=await import('/src/components/query/FilmServiceDialog.vue');
window.filmState={holdRead:true,stocks:{1:{56:100,57:100},2:{56:80,57:80}},orders:{},rows:Array.from({length:21},(_,index)=>({
  id:index+1,order_id:index+1,order_no:index===0?'SO38cc1234567890123456361697':'ISOLATED-FILM-'+(index+1),phone_id:index%2?12:11,quantity:2,store_id:1,store_name:index===0?'腾飞1店':'一店',operator_id:7,operator_name:index===0?'Boss':'样本销售员',
  business_time:'2026-11-14 09:00:00',created_at:'2026-11-14 09:01:00',phone_model_name:'18promax',items:[{name:index===0?'高铝膜17-18max':'历史免费膜'+index,sale_type:'gift',quantity:2,total_amount:0}]}))};
window.fixture.filmReads=[];
window.fixture.denied.push('accessories:view','accessories:create','accessories:gift','query:goods-view','query:goods-sell','query:goods-gift');
const quotePost=window.mockPost;
window.mockRead=(url,config)=>{
  window.fixture.filmReads.push({url,config:JSON.parse(JSON.stringify(config))});
  const state=window.filmState;
  if(url==='/query/customers/9/film-services'){
    if(config.params.phone_id!==11)throw Error('缺少当前手机关联');
    const {page,page_size:size,sale_type:saleType}=config.params,total=state.rows.length;
    const paid=row=>row.items.some(item=>item.sale_type==='sale');
    const paidCount=state.rows.filter(paid).length;
    const rows=saleType==='sale'?state.rows.filter(paid):saleType==='gift'?state.rows.filter(row=>!paid(row)):state.rows;
    const filteredTotal=rows.length;
    const response={success:true,data:{customer_id:9,eligible_for_free:true,device:{phone_id:11,model_id:13,model_name:'iPhone 13'},
      service_count:total,free_count:total-paidCount,paid_count:paidCount,film_quantity:state.rows.reduce((sum,row)=>sum+row.quantity,0),
      device_service_count:state.rows.filter(row=>row.phone_id===11).length,
      device_film_quantity:state.rows.filter(row=>row.phone_id===11).reduce((sum,row)=>sum+row.quantity,0),
      data:structuredClone(rows.slice((page-1)*size,page*size)),pagination:{page,page_size:size,total:filteredTotal,total_pages:Math.ceil(filteredTotal/size),has_next:page*size<filteredTotal,has_prev:page>1}}};
    if(state.holdRead){state.holdRead=false;return new Promise(resolve=>{window.releaseFilmRead=()=>resolve(response)})}
    return response;
  }
  if(url!=='/query/customers/9/film-services/products'||config.params.phone_id!==11||!state.stocks[config.params.store_id])throw Error('收费须按服务店及当前型号读取适配膜');
  window.fixture.reads.push(structuredClone(config.params));
  const rows=[{id:56,name:'收费高清膜',barcode:'000456',sale_price:20},{id:57,name:'免费普通膜',barcode:'000457',sale_price:5}]
    .filter(row=>(!config.params.free_only||row.id===57)&&(!config.params.search||row.name.includes(config.params.search)||row.barcode.includes(config.params.search)))
    .map(row=>({...row,brand_name:'样本膜品牌',product_model:'通用',quantity:state.stocks[config.params.store_id][row.id],serial_quantity:0}));
  return {success:true,data:{data:rows,pagination:{total:rows.length}}};
};
window.mockPost=async(url,input)=>{
  if(url==='/query/film-services/checkout/quote')return quotePost('/sales/checkout/quote',input);
  if(url!=='/query/film-services/checkout')throw Error('未登记的隔离贴膜提交');
  const data=JSON.parse(JSON.stringify(input));window.fixture.posts.push({url,data});
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseCheckout=done)}
  const state=window.filmState;
  if(data.film_service?.customer_id!==9||data.film_service.phone_id!==11||data.phones.length||!state.stocks[data.store_id])throw Error('贴膜提交手机、客户或门店错误');
  if(!state.orders[data.request_key]){
    const free=data.film_service.mode==='free';
    if(free&&(data.accessories.length||data.film_service.accessory_id!==57))throw Error('免费请求须明确选择适配商品');
    const goods=free?[{accessory_id:57,quantity:data.film_service.quantity,sale_type:'gift',unit_price:0}]:data.accessories;
    const quantity=goods.reduce((sum,row)=>sum+row.quantity,0),id=state.rows.length+1;
    for(const row of goods)state.stocks[data.store_id][row.accessory_id]-=row.quantity;
    const result={order_id:id,film_service_id:id,order_no:'ISOLATED-FILM-'+id,items:[],payment_ids:[],total_amount:data.payment_info.payment_amount,paid_amount:data.payment_info.payment_amount,points_earned:0,
      points_used:goods.reduce((sum,row)=>sum+(row.redeem_points||0),0)};
    state.orders[data.request_key]=result;
    state.rows.unshift({id,order_id:id,order_no:result.order_no,phone_id:11,quantity,store_id:data.store_id,store_name:data.store_id===2?'二店':'一店',operator_id:data.operator_id,
      operator_name:'样本销售员',business_time:data.sale_time,created_at:'2026-11-14 10:01:00',phone_model_name:'18promax',items:goods.map(row=>({
        name:row.accessory_id===57?'免费普通膜':'收费高清膜',sale_type:row.sale_type,quantity:row.quantity,total_amount:row.unit_price*row.quantity-(row.redeem_points||0)/10}))});
  }
  // 模拟已提交但回执丢失，验证页面原键重试；不代表真实MySQL并发验收。
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离提交结果未知')}
  return {success:true,data:structuredClone(state.orders[data.request_key])};
};
const open=ref(true);window.reopen=()=>{open.value=true};
const app=createApp({render:()=>h(Film,{modelValue:open.value,'onUpdate:modelValue':value=>{open.value=value;window.fixture.open=value},
  phoneId:11,customer:{id:9,name:'样本客户',phone:'13900000001'}})});
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,AmountInput,PaymentMethodSelect,PaymentChannelSelect,RecordDescriptions,DataEmptyState,Pagination}))app.component(name,component);
app.directive('permission',{});app.directive('tf-loading',vTFLoading);app.mount('#app');
`

async function paidMode(page) {
  const radio = await page.$('.el-radio-button input[value="paid"]')
  await clickVisible(await radio.evaluateHandle(element => element.closest('.el-radio-button')))
}
async function openCheckout(page) {
  await paidMode(page)
  await clickButton(page, '选择商品并收款')
  await page.waitForFunction(() => document.body.textContent.includes('确认办理贴膜') && !document.body.textContent.includes('正在读取销售门店'))
  for (const [label, value] of [['客户姓名', '样本客户'], ['客户手机号', '13900000001']]) {
    assert.deepEqual(await (await field(page, label)).$eval('input', element => ({ value: element.value, readonly: element.readOnly })), { value, readonly: true })
  }
}
async function counts(page) {
  return page.evaluate(() => ({ services: window.filmState.rows.length, quantity: window.filmState.rows.reduce((sum, row) => sum + row.quantity, 0),
    stocks: structuredClone(window.filmState.stocks), posts: window.fixture.posts.filter(row => row.url === '/query/film-services/checkout').length }))
}
async function expectHistory(page, services, quantity) {
  await page.waitForFunction((services, quantity) => {
    const summary = document.querySelector('dl[aria-label="客户及贴膜统计"]')
    const labels = [...summary.querySelectorAll('dt')], values = [...summary.querySelectorAll('dd')]
    const read = label => values[labels.findIndex(element => element.textContent.trim() === label)]?.textContent.trim()
    const deviceRows = window.filmState.rows.filter(row => row.phone_id === 11)
    return !document.body.textContent.includes('确认办理贴膜') && read('累计总贴膜') === `${services} 次 · ${quantity} 张` &&
      read('本机累计贴膜') === `${deviceRows.length} 次 · ${deviceRows.reduce((sum, row) => sum + row.quantity, 0)} 张`
  }, {}, services, quantity)
  const latest = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.filmReads.filter(row => row.url.endsWith('/film-services')).at(-1))))
  assert.deepEqual(latest.config.params, { page: 1, page_size: 10, phone_id: 11 }, '成功重读本次手机的第一页历史')
  assert.equal(latest.config.useCache, false)
}

async function reopenFilm(page) {
  await clickVisible(await page.$('.mobile-dialog .el-dialog__headerbtn, .el-dialog__headerbtn'))
  await page.waitForFunction(() => window.fixture.open===false)
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-dialog')].some(element => element.checkVisibility()))
  await page.waitForFunction(() => !document.querySelector('.el-dialog .film-history'))
  await page.evaluate(() => window.reopen())
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='确认免费贴膜'))
}

export async function verifyFilmService(page, capture = async () => {}) {
  await page.waitForSelector('.tf-query-modal-section + .section-loading')
  await page.waitForFunction(() => document.getAnimations().every(animation =>
    animation.playState !== 'running' || animation.effect.getComputedTiming().iterations === Infinity))
  const verifySummarySpacing = async stage => {
    const layout = await page.evaluate(() => {
      const summary = document.querySelector('dl[aria-label="客户及贴膜统计"]').parentElement
      const next = summary.nextElementSibling
      const style = getComputedStyle(summary)
      return {
        expected: parseFloat(style.getPropertyValue(innerWidth <= 767 ? '--tf-space-3' : '--tf-space-6')),
        margin: parseFloat(style.marginBottom),
        gap: next.getBoundingClientRect().top - summary.getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      }
    })
    assert.ok(layout.expected > 0 && Math.abs(layout.margin - layout.expected) < 1 && layout.gap >= layout.expected - 1,
      `${stage}：客户摘要和下方内容应保留公共分区间距：${JSON.stringify(layout)}`)
    assert.equal(layout.overflow, false, `${stage}：贴膜弹窗不得撑出页面`)
  }
  await verifySummarySpacing('读取中')
  await capture('loading')
  await page.evaluate(() => window.releaseFilmRead())
  await page.waitForSelector('.film-history-card')
  await verifySummarySpacing('读取完成')
  const lines=await page.evaluate(()=>{
    const header=document.querySelector('.film-history-card__header'), product=document.querySelector('.film-history-product')
    const sameLine=(container,selectors)=>{
      const bounds=container.getBoundingClientRect()
      return selectors.every(selector=>{
        const element=container.querySelector(selector),rect=element.getBoundingClientRect()
        return rect.top>=bounds.top-1&&rect.bottom<=bounds.bottom+1&&rect.left>=bounds.left-1&&rect.right<=bounds.right+1
      })
    }
    const meta=document.querySelector('.film-history-meta'),metaBounds=meta.getBoundingClientRect()
    const metaSingleLine=[...meta.children].every(element=>{
      const rect=element.getBoundingClientRect()
      return rect.top>=metaBounds.top-1&&rect.bottom<=metaBounds.bottom+1
    })
    const heading=document.querySelector('.film-history__heading'), headingBounds=heading.getBoundingClientRect()
    const segments=[...document.querySelectorAll('.film-history-filter .el-radio-button__inner')]
    const segmentRects=segments.map(element=>element.getBoundingClientRect())
    const publicHeight=parseFloat(getComputedStyle(segments[0]).getPropertyValue(innerWidth<=767?'--mobile-control-height':'--input-height-default'))
    const controlHeight=segments.every(element=>Math.abs(element.getBoundingClientRect().height-publicHeight)<1)
    const displayControlsEqual=[...document.querySelectorAll('.film-history-sort')]
      .filter(element=>element.checkVisibility())
      .every(element=>Math.abs(element.getBoundingClientRect().height-publicHeight)<1)
    const order=document.querySelector('.film-history-order')
    const badgeHeight=parseFloat(getComputedStyle(order).getPropertyValue('--admin-data-table-badge-height'))
    const compactControlsEqual=badgeHeight===20&&[...document.querySelectorAll('.film-history-order, .film-history-card__header .el-tag')]
      .filter(element=>element.checkVisibility())
      .every(element=>Math.abs(element.getBoundingClientRect().height-badgeHeight)<1)
    const equalSegments=segmentRects.every(rect=>Math.abs(rect.width-segmentRects[0].width)<1&&Math.abs(rect.height-segmentRects[0].height)<1)
    const filterBounds=document.querySelector('.film-history-filter').getBoundingClientRect()
    const headingFits=filterBounds.right<=headingBounds.right+1&&filterBounds.top>=headingBounds.top-1&&filterBounds.bottom<=headingBounds.bottom+1
    const modeLabel=[...document.querySelectorAll('.el-form-item__label')].some(element=>element.textContent.includes('办理方式'))
    return { compactControlsEqual,displayControlsEqual,metaSingleLine,controlHeight,equalSegments,headingFits,modeLabel,header:sameLine(header,['.film-history-device','.film-history-card__badges','.film-history-order','.film-history-order__copy']),
      product:sameLine(product,['.film-history-product__name','.film-history-product__details']),
      overflow:document.documentElement.scrollWidth>innerWidth+1 }
  })
  assert.deepEqual(lines,{ compactControlsEqual:true,displayControlsEqual:true,metaSingleLine:true,controlHeight:true,equalSegments:true,headingFits:true,modeLabel:false,header:true,product:true,overflow:false },'筛选与排序30px、标签与单号20px，复制图标不溢出且设备和商品分别同行')
  const filter=async value=>{
    await clickVisible(await (await page.$('.film-history-filter input[value="'+value+'"]')).evaluateHandle(element=>element.closest('.el-radio-button')))
    await page.waitForFunction(value=>window.fixture.filmReads.filter(row=>row.url.endsWith('/film-services')).at(-1)?.config.params.sale_type===(value==='free'?'gift':value==='paid'?'sale':undefined),{},value)
  }
  await filter('paid')
  await page.waitForFunction(()=>document.querySelectorAll('.film-history-card').length===0)
  await filter('free')
  await page.waitForSelector('.film-history-card')
  await filter('all')
  await page.waitForSelector('.film-history-card')
  const summary = await page.$('dl[aria-label="客户及贴膜统计"]')
  const layout = await summary.evaluate(element => {
    const fields = [...element.children].map(field => {
      const rect = field.getBoundingClientRect()
      const label = field.querySelector('dt').getBoundingClientRect(), value = field.querySelector('dd').getBoundingClientRect()
      return { x: rect.x, y: rect.y, right: rect.right, width: rect.width, height: rect.height,
        inline: value.x >= label.right && value.y < label.bottom && label.y < value.bottom }
    })
    const rect = element.getBoundingClientRect()
    const deviceColor = getComputedStyle(element.children[2].querySelector('.el-text')).color
    const totalColor = getComputedStyle(element.children[3].querySelector('.el-text')).color
    return { fields, x: rect.x, right: rect.right, width: rect.width, deviceColor, totalColor }
  })
  assert.equal(layout.fields.length, 4, '客户身份与本机/客户累计完整展示')
  const [name, phone, device, total] = layout.fields
  assert.ok(Math.abs(name.width - phone.width) <= 1 && name.width > layout.width * 0.4, '两列均分可用宽度，不能挤在左侧')
  assert.ok(Math.abs(name.x - layout.x) <= 1 && Math.abs(phone.right - layout.right) <= 1, '左右字段铺满信息面板')
  assert.ok(Math.abs(name.y - phone.y) <= 1 && Math.abs(device.y - total.y) <= 1 && device.y >= name.y + name.height, '姓名/手机号及两种累计各自同排')
  assert.ok(Math.abs(name.x - device.x) <= 1 && Math.abs(phone.x - total.x) <= 1, '上下两行列起点对齐')
  assert.ok(layout.fields.every(field => field.inline), '标签和值同行，给下方历史保留高度')
  assert.notEqual(layout.deviceColor, layout.totalColor, '本机与总累计沿用不同公共语义色')
  await expectHistory(page, 21, 42)
  await capture('summary')
  const initial = await counts(page)
  assert.equal(await (await button(page, '确认免费贴膜')).evaluate(element => element.disabled), true, '服务门店必选')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.el-form-item__label')].some(element => element.textContent.trim() === '商品名称')), false, '免费使用独立选择商品字段')
  assert.equal(await (await field(page, '耗膜数量')).$eval('input', element => element.value), '1')
  await page.evaluate(() => { const list=document.querySelector('.film-history-list'); list.scrollTop=list.scrollHeight })
  await page.waitForFunction(() => document.querySelectorAll('.film-history-card').length===20)
  await page.evaluate(() => { const list=document.querySelector('.film-history-list'); list.scrollTop=list.scrollHeight })
  await page.waitForFunction(() => document.body.textContent.includes('历史免费膜20'))
  await openCheckout(page)
  await select(page, '销售门店', '一店')
  await select(page, '商品名称', '免费普通膜', 0, '000457')
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.body.textContent.includes('确认办理贴膜'))
  assert.deepEqual(await counts(page), initial, '收费选品取消不扣库')
  await clickVisible(await (await page.$('.el-radio-button input[value="free"]')).evaluateHandle(element => element.closest('.el-radio-button')))
  await select(page, '服务门店', '二店')
  await input(page, '耗膜数量', '3')
  await checkBoundaries(page)
  await summary.evaluate(element => element.scrollIntoView({ block: 'start' }))
  await capture()
  assert.equal(await (await button(page, '确认免费贴膜')).evaluate(element => element.disabled), false, '仅综合查询贴膜授权也可办理，不需商品查看、销售或赠送')
  assert.equal((await counts(page)).posts, 0, '确认前不能办理')
  await page.evaluate(() => { window.fixture.holdNext = window.fixture.failNext = true })
  await clickButton(page, '确认免费贴膜')
  await page.waitForFunction(() => window.fixture.posts.length === 1)
  assert.equal(await (await button(page, '确认免费贴膜')).evaluate(element => element.disabled), true, '提交中防连点')
  await page.evaluate(() => window.releaseCheckout())
  await page.waitForFunction(() => document.body.textContent.includes('办理结果尚未确认'))
  assert.equal((await counts(page)).services, 22)
  assert.deepEqual(await page.$$eval('.el-form input', elements => elements.filter(element => !element.disabled).map(element => element.getAttribute('aria-label'))), [], '未知结果冻结原请求')
  await clickButton(page, '重试原贴膜办理')
  await expectHistory(page, 22, 45)
  const free = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts)))
  assert.equal(free.length, 2); assert.deepEqual(free[0].data, free[1].data)
  assert.deepEqual(free[0].data.film_service, { customer_id: 9, phone_id: 11, mode: 'free', quantity: 3, accessory_id: 57 })
  assert.equal(free[0].data.store_id, 2); assert.equal(free[0].data.operator_id, 7)
  assert.deepEqual(free[0].data.accessories, [])
  assert.equal(free[0].data.payment_info.payment_amount, 0)
  assert.deepEqual((await counts(page)).stocks, { 1: { 56: 100, 57: 100 }, 2: { 56: 80, 57: 77 } })

  await reopenFilm(page)
  await openCheckout(page)
  await select(page, '销售门店', '二店')
  await select(page, '商品名称', '收费高清膜', 0)
  await select(page, '支付方式', '现金')
  assert.equal(await (await field(page, '出库方式', 0)).$eval('.el-select', element => element.textContent.trim()), '销售', '收费默认正常销售')
  await input(page, '本条抵扣积分', '10', 0)
  await clickButton(page, '确认办理贴膜')
  await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('积分试算'))
  assert.equal((await counts(page)).posts, 2)
  await clickButton(page, '积分试算')
  await page.waitForFunction(() => document.body.textContent.includes('可用积分 1000'))
  await checkBoundaries(page)
  await clickButton(page, '确认办理贴膜')
  await expectHistory(page, 23, 46)
  const paid = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts.at(-1).data)))
  assert.notEqual(paid.request_key, free[0].data.request_key)
  assert.deepEqual(paid.film_service, { customer_id: 9, phone_id: 11, mode: 'paid' })
  assert.deepEqual(paid.accessories.map(row => [row.accessory_id, row.quantity, row.sale_type, row.unit_price, row.redeem_points]), [[56, 1, 'sale', 20, 10]])
  assert.equal(paid.payment_info.payment_amount, 19)
  assert.deepEqual((await counts(page)).stocks, { 1: { 56: 100, 57: 100 }, 2: { 56: 79, 57: 77 } })
  await reopenFilm(page)
  await openCheckout(page)
  await page.evaluate(() => window.fixture.hidden.push('price_info.total_price'))
  await page.waitForFunction(() => !document.body.textContent.includes('确认办理贴膜'))
  assert.equal((await counts(page)).posts, 3)
  await page.evaluate(() => window.fixture.denied.push('query:film'))
  await page.waitForFunction(() => document.body.textContent.includes('缺少贴膜权限'))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('免费普通膜') || document.body.textContent.includes('收费高清膜')), false)
}
