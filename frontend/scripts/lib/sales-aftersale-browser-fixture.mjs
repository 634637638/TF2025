import assert from 'node:assert/strict'
import { salesEnvironment, clickVisible, button, clickButton, field, input, select, checkBoundaries } from './sales-checkout-browser-fixture.mjs'

// 真实退库窗口、原单核对及联合退货表单；金额仅为内存样本，不代替后端积分与资金核验。
export const phoneReturnEntry = `${salesEnvironment}
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
const {default:ReturnStock}=await import('/src/components/query/ReturnStockModal.vue');
const checklist={mode:'checkout',order_id:10,order_no:'SO-ORIGINAL',store_id:1,
  phone:{item_id:50,sale_id:20,phone_id:30,total_amount:100,points_awarded:10},
  accessories:[{item_id:51,accessory_id:5,accessory_sale_id:1,sale_type:'sale',name:'收费充电器',quantity:3,
    returned_quantity:0,remaining_quantity:3,serial_numbers:[],available_serial_numbers:[],unit_price:20,total_amount:60,
    gift_return_unit_price:null,gift_return_total:null,remaining_gift_return_total:null,gift_agreement_state:null},
  {item_id:52,accessory_id:6,accessory_sale_id:2,sale_type:'gift',name:'原赠品',quantity:3,
    returned_quantity:1,remaining_quantity:2,serial_numbers:['SN01','SN02','SN03'],available_serial_numbers:['SN02','SN03'],
    unit_price:0,total_amount:0,gift_return_unit_price:5,gift_return_total:15,remaining_gift_return_total:10,gift_agreement_state:'recorded'}]};
window.mockRead=(url,config)=>{
  window.fixture.reads.push({url,useCache:config.useCache});
  if(url!=='/sales/checkout/phones/30/return-checklist')throw Error('未登记的售后隔离读取');
  return {success:true,data:structuredClone(checklist)};
};
window.mockPost=async(url,input)=>{
  const data=JSON.parse(JSON.stringify(input));window.fixture.posts.push({url,data});
  if(!['/sales/checkout/10/phones/20/return/quote','/sales/checkout/10/phones/20/return'].includes(url))throw Error('未登记的售后隔离提交');
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseReturn=done)}
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离提交结果未知')}
  const rows=data.accessories.map(row=>{
    const item=checklist.accessories.find(item=>item.item_id===row.item_id);
    const remaining=item.remaining_quantity-row.quantity,missing=item.sale_type==='gift'&&row.charge_missing?remaining:0;
    return {item_id:row.item_id,returned_quantity:row.quantity,remaining_quantity:remaining,gift_charge_quantity:missing,gift_charge_amount:missing*5};
  });
  const base=100+data.accessories[0].quantity*20,charge=rows.reduce((sum,row)=>sum+row.gift_charge_amount,0);
  const recovery=scenario==='phone-collection'?140:10,net=base-charge-recovery;
  return {success:true,data:{order_id:10,sale_id:20,phone_id:30,store_id:data.store_id,
    base_refund_amount:base,points_recovery_amount:recovery,points_compensation_amount:0,gift_charge_amount:charge,
    refund_amount:Math.max(0,net),collection_amount:Math.max(0,-net),points_delta:-10,accessories:rows,
    ...(url.endsWith('/quote')?{}:{aftersale_id:101})}};
};
const open=ref(true);
const app=createApp({render:()=>h(ReturnStock,{modelValue:open.value,'onUpdate:modelValue':value=>{open.value=value;window.fixture.open=value},
  deviceInfo:{id:30,brand:'苹果',model:'手机甲',color:'黑色',memory:'128G',supplier_name:'手机供应商',is_new:1,imei:'012345678901234',serial_number:'PHONE0030'},
  onSuccess:()=>window.fixture.success.push(true)})});
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,AmountInput,PaymentMethodSelect,PaymentChannelSelect,RecordDescriptions,DataEmptyState}))app.component(name,component);
app.directive('permission',{});app.mount('#app');
`

async function check(page, text) {
  for (const box of await page.$$('.el-checkbox')) if (await box.evaluate((element, text) => element.textContent.trim().includes(text), text)) {
    await clickVisible(box)
    return
  }
  assert.fail(`没有找到复选项 ${text}`)
}

export async function verifyPhoneReturn(page, scenario) {
  const collection = scenario === 'phone-collection'
  await page.waitForFunction(() => document.body.textContent.includes('手机及关联商品退货') && !document.body.textContent.includes('正在读取接收门店'))
  assert.equal(await page.$$('button').then(async buttons => {
    for (const item of buttons) if (await item.evaluate(element => element.checkVisibility() && element.textContent.trim() === '确认退库')) return true
    return false
  }), false, '共同单不能显示旧独立退库提交')
  assert.equal(await page.$eval('input[aria-label="收费充电器退回数量"]', element => element.value), '0', '收费商品默认保留')
  assert.equal(await page.evaluate(() => window.fixture.reads[0].useCache), false)
  await select(page, '接收门店', '二店')
  await select(page, '退货原因', '客户退货')
  const quantity = await page.$('input[aria-label="收费充电器退回数量"]')
  await clickVisible(quantity)
  await quantity.evaluate(element => element.select())
  await page.keyboard.type('1')
  await page.keyboard.press('Tab')
  await select(page, '本次退回SN', 'SN03')
  await check(page, '确认 1 件赠品未退')
  await input(page, '备注', '手机与关联配件退货')
  await check(page, '已核验手机及本次退回商品实物')
  await clickButton(page, '核对退款')
  await page.waitForFunction(() => document.body.textContent.includes('客户需补差价'))
  const quotes = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts)))
  assert.equal(quotes.length, 1)
  assert.deepEqual(quotes[0].data.accessories, [
    { item_id:51,quantity:1,serial_numbers:[],charge_missing:false,charge_confirmed:false },
    { item_id:52,quantity:1,serial_numbers:['SN02'],charge_missing:true,charge_confirmed:true }
  ])
  assert.equal(await (await button(page, '确认退货')).evaluate(element => element.disabled), true, '未确认资金不得提交')
  await select(page, collection ? '补款方式' : '退款方式', collection ? '现金' : '移动支付')
  if (!collection) await select(page, '支付渠道', '微信')
  await check(page, collection ? '确认已收取客户需补差价' : '确认已按本次应退金额退款')
  await checkBoundaries(page)
  await page.evaluate(() => { window.fixture.holdNext = true; window.fixture.failNext = true })
  await clickButton(page, '确认退货')
  await page.waitForFunction(() => window.fixture.posts.length === 2)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '确认退货')).evaluate(element => element.disabled), true)
  await page.evaluate(() => window.releaseReturn())
  await page.waitForFunction(() => document.body.textContent.includes('提交结果未确认'))
  assert.deepEqual(await page.$$eval('.el-form input, .el-form textarea', elements => elements.filter(element => !element.disabled)
    .map(element => element.closest('.el-form-item')?.textContent)), [], '结果未知应冻结实物、SN及资金确认')
  assert.equal(await (await button(page, '核对退款')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), false)
  await clickButton(page, '确认退货')
  await page.waitForFunction(() => window.fixture.success.length === 1 && !window.fixture.open)
  const posts = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts)))
  assert.equal(posts.length, 3)
  assert.deepEqual(posts[1], posts[2], '未知结果必须按原请求键和完整载荷重试')
  assert.equal(posts[1].url, '/sales/checkout/10/phones/20/return')
  const data = posts[1].data
  assert.equal(data.store_id, 2); assert.equal(data.return_reason, '客户退货')
  assert.equal(data.remarks, '手机与关联配件退货'); assert.equal(data.restock_confirmed, true)
  assert.match(data.reversal_date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.deepEqual(data.settlement, { refund_amount:collection ? 0 : 105,collection_amount:collection ? 25 : 0,
    method:collection ? 'cash' : 'mobile',channel:collection ? null : 'wechat',confirmed:true })
}

// 复用真实商品换货窗口；原单、库存候选及报价仅为内存样本，不代替后端计算和返库事务。
export const goodsExchangeEntry = `${salesEnvironment}
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
const {default:Exchange}=await import('/src/views/query/page/GoodsReturnDialog.vue');
const gift=scenario==='exchange-gift',down=scenario==='exchange-down';
const context={order_id:10,item_id:50,name:gift?'已扣款赠品':'原单充电器',sale_type:gift?'gift':'sale',
  quantity:3,returned_quantity:1,remaining_quantity:2,serial_tracking:true,serial_numbers:['OLD02','OLD03'],
  replacement_sale_type:'sale',gift_charge_settled:gift};
const sale={id:51,accessory_id:5,order_id:10,order_item_id:50,sale_no:'AS-ORIGINAL',order_no:'SO-ORIGINAL',
  linked_phone_invoice:null,sale_type:context.sale_type,store_id:1,store_name:'一店',name:context.name,barcode:null,
  category:'充电器',brand_name:'原品牌',product_model:'原型号',color_name:'白色',unit:'个',customer_name:'样本客户',
  customer_phone:'13900000001',quantity:3,unit_price:gift?0:down?50:20,total_price:gift?0:down?150:60,
  purchase_cost:null,profit:null,points_awarded:gift?0:6,operator_name:'原销售员',sale_time:'2026-11-14 10:00:00',remarks:'',has_snapshot:1};
const readGoods=window.mockRead;
window.mockRead=(url,config)=>{
  if(url==='/sales/checkout/10/items/50/exchange'){
    window.fixture.reads.push({url,useCache:config.useCache});return {success:true,data:structuredClone(context)};
  }
  return readGoods(url,config);
};
window.mockPost=async(url,input)=>{
  if(!['/sales/checkout/10/items/50/exchange/quote','/sales/checkout/10/items/50/exchange'].includes(url))throw Error('未登记的换货隔离提交');
  const data=JSON.parse(JSON.stringify(input));window.fixture.posts.push({url,data});
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseExchange=done)}
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离换货提交结果未知')}
  const base=(gift?12:down?50:20)*data.quantity,used=data.replacement.redeem_points||0,deduction=used/10;
  const replacement=Math.round(data.replacement.unit_price*100)*data.quantity/100-deduction;
  const collection=Math.max(0,replacement-base),refund=Math.max(0,base-replacement),earned=used?0:5;
  return {success:true,data:{order_id:10,item_id:50,store_id:data.store_id,quantity:data.quantity,
    serial_numbers:data.serial_numbers,remaining_quantity:context.remaining_quantity-data.quantity,
    base_refund_amount:base,points_recovery_amount:0,points_compensation_amount:0,refund_amount:refund,collection_amount:collection,
    points_delta:earned-used-(gift?0:2),points_award_returned:gift?0:2,points_redemption_returned:0,
    operator_id:data.operator_id,replacement_accessory_id:data.replacement.accessory_id,
    replacement_serial_numbers:data.replacement.serial_numbers||[],replacement_amount:replacement,
    replacement_paid_amount:Math.min(collection,replacement),original_collection_amount:Math.max(0,collection-replacement),
    points_used:used,points_earned:earned,deduction_amount:deduction,
    ...(url.endsWith('/quote')?{}:{aftersale_id:101,replacement_order_id:11,replacement_item_id:51,root_order_id:10,root_item_id:50,
      exchange_credit_amount:Math.max(0,replacement-collection)})}};
};
const open=ref(true);window.reopen=()=>{open.value=true;window.fixture.open=true};
const app=createApp({render:()=>h(Exchange,{modelValue:open.value,'onUpdate:modelValue':value=>{open.value=value;window.fixture.open=value},
  sale,mode:'exchange',onSuccess:()=>window.fixture.success.push(true)})});
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,AmountInput,PaymentMethodSelect,PaymentChannelSelect,RecordDescriptions}))app.component(name,component);
app.directive('permission',{});app.mount('#app');
`

export async function verifyGoodsExchange(page, scenario) {
  const down = scenario === 'exchange-down', gift = scenario === 'exchange-gift'
  const price = down ? 20 : 50, points = gift ? 10 : 0, cash = gift ? 37 : 30
  await page.waitForFunction(() => document.body.textContent.includes('剩余可退') && !document.body.textContent.includes('正在核对原单'))
  assert.equal(await page.evaluate(() => window.fixture.reads[0].useCache), false)
  assert.equal(await page.$eval('input[aria-label="SN退货数量"]', element => element.value), '0')
  if (gift) assert.equal(await page.evaluate(() => document.body.textContent.includes('按原实际扣款抵付')), true)
  await select(page, '退回门店', '二店')
  await select(page, '退货原因', '客户退货')
  await select(page, '本次退回SN', 'OLD02')
  await select(page, '新商品销售员', '样本销售员')
  await select(page, '商品名称', '原装充电器', 0, '000123')
  assert.equal(await page.evaluate(() => window.fixture.reads.some(row => row.search === '000123' && row.store_id === 2)), true)
  await input(page, '单价', String(price), 0)
  await input(page, '本条抵扣积分', String(points), 0)
  const quantity = await (await field(page, '数量', 0)).$('input')
  assert.equal(await quantity.evaluate(element => element.disabled), true, '换入数量必须跟随原件')
  const type = await (await field(page, '出库方式', 0)).$('input')
  assert.equal(await type.evaluate(element => element.disabled), true, '换入用途由服务端核对结果锁定')
  if (scenario === 'exchange-up') {
    await clickVisible(await (await field(page, 'SN模式', 0)).$('.el-switch'))
    await input(page, '实际出库SN（每行一件，支持扫码枪输入）', 'NEW01', 0)
    assert.equal(await (await field(page, 'SN数量', 0)).$eval('input', element => element.value), '1')
  }
  await input(page, '备注', '原单换货并记录新销售员')
  await check(page, '已核验退回实物')
  await clickButton(page, '核对换货差价')
  await page.waitForFunction(() => document.body.textContent.includes('新件净应付'))
  assert.equal(await (await button(page, '确认换货')).evaluate(element => element.disabled), true)
  // 旧报价不应在修改新件售价后继续提交。
  await input(page, '单价', String(price + 1), 0)
  await page.waitForFunction(() => !document.body.textContent.includes('新件净应付'))
  assert.equal(await (await button(page, '确认换货')).evaluate(element => element.disabled), true)
  await input(page, '单价', String(price), 0)
  await clickButton(page, '核对换货差价')
  await page.waitForFunction(() => document.body.textContent.includes('新件净应付'))
  await select(page, down ? '退款方式' : '补款方式', down ? '移动支付' : '现金')
  if (down) await select(page, '支付渠道', '微信')
  await check(page, down ? '确认已按本次应退金额退款' : '确认已收取客户需补差价')
  await checkBoundaries(page)
  await page.evaluate(() => { window.fixture.holdNext = true; window.fixture.failNext = true })
  await clickButton(page, '确认换货')
  await page.waitForFunction(() => window.fixture.posts.length === 3)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), true)
  await page.evaluate(() => window.releaseExchange())
  await page.waitForFunction(() => document.body.textContent.includes('提交结果未确认'))
  assert.deepEqual(await page.$$eval('.el-form input, .el-form textarea', elements => elements.filter(element => !element.disabled)
    .map(element => element.closest('.el-form-item')?.textContent)), [])
  assert.equal(await (await button(page, '核对换货差价')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), false)
  await clickButton(page, '确认换货')
  await page.waitForFunction(() => window.fixture.success.length === 1 && !window.fixture.open)
  const posts = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts)))
  assert.equal(posts.length, 4)
  assert.deepEqual(posts[2], posts[3], '未知结果必须按原键和完整换货载荷重试')
  assert.equal(posts[2].url, '/sales/checkout/10/items/50/exchange')
  assert.deepEqual(posts[2].data, {
    request_key: posts[2].data.request_key, store_id: 2, quantity: 1, serial_numbers: ['OLD02'], return_reason: '客户退货',
    reversal_date: posts[2].data.reversal_date, remarks: '原单换货并记录新销售员', restock_confirmed: true, operator_id: 7,
    replacement: { accessory_id: 56, unit_price: price, ...(scenario === 'exchange-up' ? { serial_numbers: ['NEW01'] } : {}), ...(points ? { redeem_points: points } : {}) },
    settlement: { refund_amount: down ? cash : 0, collection_amount: down ? 0 : cash,
      method: down ? 'mobile' : 'cash', channel: down ? 'wechat' : null, confirmed: true }
  })
  assert.match(posts[2].data.request_key, /^[a-f0-9]{32}$/)
  assert.match(posts[2].data.reversal_date, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  await page.evaluate(() => window.reopen())
  await page.waitForFunction(() => document.body.textContent.includes('剩余可退') && !document.body.textContent.includes('正在核对原单'))
  await page.evaluate(() => window.fixture.denied.push('query:exchange'))
  await page.waitForFunction(() => document.body.textContent.includes('缺少换货必要权限'))
  assert.equal(await page.$('.el-form'), null, '撤权后不保留可操作草稿')
  assert.equal(await (await button(page, '确认换货')).evaluate(element => element.disabled), true)
}
