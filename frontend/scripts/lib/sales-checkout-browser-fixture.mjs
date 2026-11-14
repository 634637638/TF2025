import assert from 'node:assert/strict'
import { resolve } from 'node:path'

// 复用正式结算组件及API；替换服务边界，任何提交只进入当前页面内存。
export const salesEnvironment = `
import {createApp,h,ref,reactive} from 'vue';
import ElementPlus from 'element-plus';
import {createPinia} from 'pinia';
import MobileDialog from '/src/components/MobileDialog.vue';
import SectionLoading from '/src/components/SectionLoading.vue';
import AmountInput from '/src/components/AmountInput.vue';
import {PaymentMethodSelect,PaymentChannelSelect} from '/src/components/payment/index.ts';
import {applyDeviceRootClass} from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/admin-layout.css';import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';import '/src/styles/components/_dialog-actions.scss';
window.fixture=reactive({denied:[],hidden:[],posts:[],reads:[],notices:[],failNext:false,holdNext:false,success:[],open:true});
const phones=[{phone_id:11,sale_price:100.01,label:'手机甲'}, {phone_id:12,sale_price:200.02,label:'手机乙'}];
const scenario=new URLSearchParams(location.search).get('scenario');
const selectedPhones=scenario==='batch'?phones:scenario==='single'?phones.slice(0,1):[];
const goods=[{id:56,name:'原装充电器',brand_name:'实际品牌',product_model:'MWVW3CH',barcode:'000123',sale_price:30,quantity:100,serial_quantity:2},
{id:57,name:'赠膜',brand_name:'膜品牌',product_model:'通用',barcode:'000124',sale_price:5,quantity:100,serial_quantity:0}];
window.mockRead=(url,config)=>{
  if(url!=='/accessories/sale-options')throw Error('未登记的隔离读取');
  window.fixture.reads.push(structuredClone(config.params));
  const rows=goods.filter(row=>!config.params.search||[row.name,row.barcode,row.product_model].some(value=>value.includes(config.params.search)));
  return {success:true,data:{data:rows,pagination:{total:rows.length}}};
};
window.mockPost=async(url,input)=>{
  const data=JSON.parse(JSON.stringify(input));window.fixture.posts.push({url,data});
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseCheckout=done)}
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离提交结果未知')}
  const gross=(data.quick_phone?Math.round(data.quick_phone.sale_price*100):0)+data.phones.reduce((sum,row)=>sum+Math.round(row.sale_price*100),0)+data.accessories.reduce((sum,row)=>sum+Math.round(row.unit_price*100)*row.quantity,0);
  const points=data.accessories.reduce((sum,row)=>sum+(row.redeem_points||0),0);
  if(url==='/sales/checkout/quote')return {success:true,data:{available_points:1000,balance:1000,redemption_ready:true,points_per_yuan:10,
    points_used:points,points_awarded:1,deduction_cents:points*10,gross_cents:gross,payable_cents:gross-points*10,balance_after:1000-points,lines:[]}};
  if(url!=='/sales/checkout')throw Error('未登记的隔离提交');
  return {success:true,data:{order_id:9,order_no:'ISOLATED-SO9',items:[],payment_ids:[],total_amount:(gross-points*10)/100,points_earned:1,points_used:points}};
};
applyDeviceRootClass();
`

export const salesCheckoutEntry = `${salesEnvironment}
const {default:Checkout}=await import('/src/views/sales/page/SalesGoodsCheckoutDialog.vue');
const open=ref(true);
window.reopen=()=>{open.value=true};
const app=createApp({render:()=>h(Checkout,{modelValue:open.value,'onUpdate:modelValue':value=>{open.value=value;window.fixture.open=value},
  phones:selectedPhones,defaults:{customer_name:'样本客户',customer_phone:'13900000001',store_id:1,operator_id:7,sale_time:'2026-11-14',payment_method:'cash',remarks:''},
  onSuccess:value=>window.fixture.success.push(value)})});
app.use(createPinia());app.use(ElementPlus);app.component('MobileDialog',MobileDialog);app.component('SectionLoading',SectionLoading);
app.component('AmountInput',AmountInput);app.component('PaymentMethodSelect',PaymentMethodSelect);app.component('PaymentChannelSelect',PaymentChannelSelect);
app.directive('permission',{});app.mount('#app');
`

export const salesPageEntry = `${salesEnvironment}
import {createRouter,createMemoryHistory,RouterView} from 'vue-router';
import {vTFLoading} from '/src/directives/index.ts';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
import {getNumberColumnMinWidth,getActionColumnMinWidth} from '/src/utils/table-layout.ts';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import TableLoadingRow from '/src/components/TableLoadingRow.vue';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import RecordDetailDialog from '/src/components/RecordDetailDialog.vue';
import Image from '/src/components/Image.vue';
window.inventory=[11,12].map((id,index)=>({id,imei:index?'112345678901234':'012345678901234',serial_number:'PHONE'+id,
  brand:'苹果',model:index?'手机乙':'手机甲',color:'黑色',memory:'128G',brand_id:1,model_id:index+1,color_id:1,memory_id:1,
  is_new:1,status:'in_stock',store_id:1,store_name:'一店',supplier_id:1,supplier_name:'手机供应商',purchase_cost:80+index,
  created_at:'2026-11-14 09:00:00',remarks:'原库存备注',image_url:''}));
window.fixture.pageReads=[];
const readGoods=window.mockRead,postGoods=window.mockPost;
window.mockRead=(url,config={})=>{
  window.fixture.pageReads.push({url,config:JSON.parse(JSON.stringify(config))});
  if(url==='/sales/phones/available')return {success:true,data:structuredClone(window.inventory),pagination:{total:window.inventory.length},stats:{}};
  if(url==='/sales/phones/available/stats')return {success:true,data:{today_sold:2-window.inventory.length}};
  return readGoods(url,config);
};
window.mockPost=async(url,data)=>{
  const response=await postGoods(url,data);
  if(url==='/sales/checkout'){
    window.inventory=window.inventory.filter(phone=>!data.phones.some(row=>row.phone_id===phone.id));
    window.fixture.success.push(response.data);
  }
  return response;
};
const {default:SalesView}=await import('/src/views/sales/SalesView.vue');
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/sales',component:SalesView}]});
await router.push('/sales');await router.isReady();
const app=createApp({render:()=>h(RouterView)});
app.use(createPinia());app.use(router);app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,AmountInput,PaymentMethodSelect,PaymentChannelSelect,
  DataEmptyState,TableLoadingRow,RecordDescriptions,RecordDetailDialog,Image}))app.component(name,component);
app.config.globalProperties.$getNumberColumnWidth=getNumberColumnMinWidth;
app.config.globalProperties.$getActionColumnWidth=getActionColumnMinWidth;
app.directive('permission',{});app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);
app.mount('#app');
`

export const quickSaleEntry = `${salesEnvironment}
const {default:QuickSale}=await import('/src/components/query/QuickSaleModal.vue');
const open=ref(true);
const options={brands:[{id:1,name:'苹果'}],models:[],colors:[{id:1,name:'黑色'}],memories:[{id:1,size:'128G'}],
  stores:[{id:1,name:'一店'}],suppliers:[{id:1,name:'手机供应商'}],users:[{id:7,name:'样本销售员'}]};
const app=createApp({render:()=>h(QuickSale,{modelValue:open.value,'onUpdate:modelValue':value=>{open.value=value;window.fixture.open=value},
  options,onSuccess:()=>window.fixture.success.push(true)})});
app.use(createPinia());app.use(ElementPlus);app.component('MobileDialog',MobileDialog);app.component('SectionLoading',SectionLoading);
app.component('AmountInput',AmountInput);app.component('PaymentMethodSelect',PaymentMethodSelect);app.component('PaymentChannelSelect',PaymentChannelSelect);
app.directive('permission',{});app.mount('#app');
`

export function createSalesCheckoutMocks(root) {
  return new Map([
    [resolve(root, 'src/utils/unified-api.ts'), 'export const unifiedApi={get:async(url,config)=>window.mockRead(url,config),post:(url,data)=>window.mockPost(url,data)};export default unifiedApi'],
    [resolve(root, 'src/stores/auth.ts'), 'export const useAuthStore=()=>({user:{id:7,name:"样本销售员",username:"fixture"},isAdmin:false,hasPermission:value=>!window.fixture.denied.includes(value),fetchUserInfo:async()=>{}})'],
    [resolve(root, 'src/composables/usePagePermissions.ts'), `import {computed} from 'vue';export const usePagePermissions=module=>({
      canView:computed(()=>!window.fixture.denied.includes(module+':view')),canCreate:computed(()=>!window.fixture.denied.includes(module+':create')),
      canSell:computed(()=>!window.fixture.denied.includes(module+':sell')),canEdit:computed(()=>false),canDelete:computed(()=>false),canExport:computed(()=>false),
      handleNoPermission:()=>{},hasPermission:action=>!window.fixture.denied.includes(module+':'+action)})`],
    [resolve(root, 'src/composables/useFieldPermissions.ts'), 'export const fieldPermissions={init:async()=>{},isFieldEditable:()=>true,isFieldVisible:(_module,field)=>!window.fixture.hidden.includes(field),getHiddenFields:()=>window.fixture.hidden};export const shouldShowActionColumn=(visible,actions)=>visible||actions.some(Boolean)'],
    [resolve(root, 'src/composables/usePermissionPreload.ts'), 'export const usePermissionPreload=()=>({preloadPermissions:async()=>{}})'],
    [resolve(root, 'src/composables/useNotification.ts'), 'export const useNotification=()=>Object.fromEntries(["success","error","warning","info"].map(type=>[type,message=>window.fixture.notices.push({type,message})]));export const notifications=useNotification()'],
    [resolve(root, 'src/services/reference-options.ts'), `export const getCachedStores=async()=>({success:true,data:[{id:1,name:'一店',status:1},{id:2,name:'二店',status:1}]});
      export const searchOperators=async()=>({success:true,data:[{id:7,name:'样本销售员',username:'fixture'}]});
      export const getCachedBrands=async()=>({success:true,data:[{id:1,name:'苹果'}]});
      export const getModels=async()=>({success:true,data:[{id:1,name:'手机甲',brand_id:1},{id:2,name:'手机乙',brand_id:1}]});
      export const getCachedColors=async()=>({success:true,data:[{id:1,name:'黑色'}]});
      export const getCachedMemories=async()=>({success:true,data:[{id:1,name:'128G',size:'128G'}]});
      export const getCachedSuppliers=async()=>({success:true,data:[{id:1,name:'手机供应商'}]});
      export const searchBrands=getCachedBrands,searchColors=getCachedColors,searchMemories=getCachedMemories`],
    [resolve(root, 'src/services/customer-options.ts'), 'export const searchCustomerOptions=async()=>[{id:9,name:"样本客户",phone:"13900000001"}]']
  ])
}

// 真实键鼠命中控件；不访问Vue实例、不直接派发组件事件或填充内部草稿。
async function clickVisible(handle, options = {}) {
  assert.ok(handle, '目标控件不存在')
  await handle.scrollIntoView()
  const hit = await handle.evaluate(async element => {
    const deadline = performance.now() + 2000
    let target
    do {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const rect = element.getBoundingClientRect()
      target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      if (element === target || element.contains(target)) return null
    } while (performance.now() < deadline)
    return { field: element.closest('.el-form-item')?.textContent || element.textContent,
      target: target?.outerHTML.slice(0, 300) }
  })
  assert.equal(hit, null, `目标控件被覆盖：${JSON.stringify(hit)}`)
  await handle.click(options)
}

async function field(page, label, row) {
  const items = row === undefined ? await page.$$('.el-form-item') : await (await goodsRows(page))[row].$$('.el-form-item')
  for (const item of items) if (await item.evaluate((element, label) => element.querySelector('.el-form-item__label')?.textContent.trim() === label, label)) return item
  assert.fail(`没有找到字段 ${label}`)
}

async function goodsRows(page) {
  const sections = await page.$$('.form-section')
  const rows = []
  for (const section of sections) if (await section.$$eval('.el-form-item__label', elements =>
    elements.some(element => element.textContent.trim() === '商品名称'))) rows.push(section)
  return rows
}

async function input(page, label, value, row) {
  const control = await (await field(page, label, row)).$('input:not([type=hidden]), textarea')
  await fillInput(page, control, value)
}

async function fillInput(page, control, value, { blur = true } = {}) {
  await clickVisible(control)
  await control.evaluate(element => element.select())
  await page.keyboard.press('Backspace')
  await page.keyboard.type(value)
  if (blur) await page.keyboard.press('Tab')
}

async function select(page, label, choice, row, search = '') {
  const item = await field(page, label, row)
  await selectItem(page, item, choice, search)
}

async function selectItem(page, item, choice, search = '') {
  await clickVisible(await item.$('.el-select'))
  const listId = await item.$eval('input[aria-controls]', element => element.getAttribute('aria-controls'))
  const selector = `#${listId} .el-select-dropdown__item`
  if (search) {
    await (await item.$('input')).type(search)
    await page.waitForFunction(search => window.fixture.reads.some(row => row.search === search), {}, search)
  }
  await page.waitForFunction((selector, choice) => [...document.querySelectorAll(selector)].some(element =>
    element.checkVisibility() && element.textContent.trim().includes(choice)), {}, selector, choice)
  const options = await page.$$(selector)
  for (const option of options) if (await option.evaluate((element, choice) => element.checkVisibility() && element.textContent.trim().includes(choice), choice)) {
    const selected = await option.evaluate(element => element.getAttribute('aria-selected'))
    await clickVisible(option)
    await page.waitForFunction((element, selected, listId) => element.getAttribute('aria-selected') !== selected ||
      [...document.querySelectorAll('input[aria-controls]')].some(control => control.getAttribute('aria-controls') === listId && control.getAttribute('aria-expanded') === 'false'), {}, option, selected, listId)
    if (await item.$eval('input[aria-controls]', element => element.getAttribute('aria-expanded') === 'true')) await page.keyboard.press('Escape')
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(element => !element.checkVisibility()), {}, selector)
    return
  }
  assert.fail(`没有找到选项 ${choice}`)
}

async function button(page, label) {
  for (const item of (await page.$$('button')).reverse()) if (await item.evaluate((element, label) => element.checkVisibility() && element.textContent.trim() === label, label)) return item
  assert.fail(`没有找到按钮 ${label}`)
}

async function clickButton(page, label) { await clickVisible(await button(page, label)) }

export { clickVisible, button, clickButton, field, input, select, checkBoundaries }

async function postCount(page, url) { return page.evaluate(url => window.fixture.posts.filter(row => row.url === url).length, url) }

async function assertBlockedSubmit(page, message) {
  const count = await postCount(page, '/sales/checkout')
  await clickButton(page, '确认整单结算')
  await page.waitForFunction(message => window.fixture.notices.at(-1)?.message.includes(message), {}, message)
  assert.equal(await postCount(page, '/sales/checkout'), count)
}

async function quote(page) {
  const count = await postCount(page, '/sales/checkout/quote')
  await clickButton(page, '积分试算')
  await page.waitForFunction(count => window.fixture.posts.filter(row => row.url === '/sales/checkout/quote').length > count && document.body.textContent.includes('可用积分 1000'), {}, count)
}

async function checkBoundaries(page) {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth > innerWidth + 1,
    fields: [...document.querySelectorAll('.el-form-item')].filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width && (rect.left < 0 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)
    }).map(element => element.textContent)
  }))
  assert.equal(overflow.page, false, '结算页面横向溢出')
  assert.deepEqual(overflow.fields, [], '结算字段超界')
}

export async function verifySalesCheckout(page, scenario) {
  await page.waitForFunction(() => document.body.textContent.includes('添加商品') && !document.body.textContent.includes('正在读取销售门店'))
  await select(page, '商品名称', '原装充电器', 0, '000123')
  assert.equal(await page.evaluate(() => window.fixture.reads.some(row => row.search === '000123')), true, '条形码未通过正式API检索')
  if (scenario === 'goods') {
    await select(page, '销售门店', '二店')
    assert.equal(await (await field(page, '商品名称', 0)).$eval('input', element => element.value), '', '切店后旧库存商品必须清空')
    await select(page, '商品名称', '原装充电器', 0)
    assert.equal(await page.evaluate(() => window.fixture.reads.at(-1).store_id), 2, '切店后只能检索新门店库存')
  }
  if (scenario === 'batch') {
    await assertBlockedSubmit(page, '关联手机')
    await select(page, '关联手机', '手机甲', 0)
  }
  await input(page, '数量', '2', 0)
  await input(page, '本条抵扣积分', '10', 0)
  await assertBlockedSubmit(page, '积分试算')
  await quote(page)
  const ordinary = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts.at(-1).data.accessories[0])))
  assert.equal(ordinary.quantity, 2)
  assert.equal(ordinary.serial_numbers, undefined, '普通数量模式不应携带SN')
  await input(page, '数量', '3', 0)
  await assertBlockedSubmit(page, '积分试算')
  await clickButton(page, '添加商品')
  await select(page, '商品名称', '赠膜', 1)
  await select(page, '出库方式', '赠送', 1)
  if (scenario === 'batch') await select(page, '关联手机', '手机乙', 1)
  await input(page, '赠品未退回约定单价（可空）', '5', 1)
  await input(page, '整单备注 / 收费库存转赠送原因', '整批一个备注')
  await clickVisible(await (await field(page, 'SN模式', 0)).$('.el-switch'))
  await input(page, '实际出库SN（每行一件，支持扫码枪输入）', '00aaa\n00aaa', 0)
  await assertBlockedSubmit(page, 'SN')
  await input(page, '实际出库SN（每行一件，支持扫码枪输入）', '00aaa\n00bbb', 0)
  assert.equal(await (await field(page, 'SN数量', 0)).$eval('input', element => element.value), '2')
  await quote(page)
  await checkBoundaries(page)
  await page.evaluate(() => { window.fixture.failNext = true; window.fixture.holdNext = true })
  await clickButton(page, '确认整单结算')
  await page.waitForFunction(() => window.fixture.posts.some(row => row.url === '/sales/checkout'))
  assert.equal(await (await button(page, '确认整单结算')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), true)
  await page.evaluate(() => window.releaseCheckout())
  await page.waitForFunction(() => document.body.textContent.includes('提交结果尚未确认'))
  assert.deepEqual(await page.$$eval('.el-form input, .el-form textarea', elements => elements.filter(element => !element.disabled)
    .map(element => element.closest('.el-form-item')?.textContent)), [], '结果未知后应冻结全部销售草稿控件')
  assert.equal(await (await button(page, '添加商品')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '积分试算')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), false)
  await clickButton(page, '确认整单结算')
  await page.waitForFunction(() => window.fixture.success.length === 1 && !window.fixture.open)
  const submissions = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts.filter(row => row.url === '/sales/checkout').map(row => row.data))))
  assert.equal(submissions.length, 2)
  assert.deepEqual(submissions[0], submissions[1], '结果未知重试必须保留原幂等键和载荷')
  const submitted = submissions[0]
  assert.deepEqual(submitted.phones.map(row => row.phone_id), scenario === 'batch' ? [11, 12] : scenario === 'single' ? [11] : [])
  assert.deepEqual(submitted.accessories.map(row => [row.accessory_id, row.sale_type, row.quantity, row.unit_price, row.linked_phone_id]),
    [[56, 'sale', 2, 30, scenario === 'goods' ? undefined : 11], [57, 'gift', 1, 0, scenario === 'goods' ? undefined : scenario === 'batch' ? 12 : 11]])
  assert.deepEqual(submitted.accessories[0].serial_numbers, ['00AAA', '00BBB'])
  assert.equal(submitted.accessories[0].redeem_points, 10)
  assert.equal(submitted.accessories[1].gift_return_unit_price, 5)
  assert.equal(submitted.remarks, '整批一个备注')
  assert.equal(submitted.store_id, scenario === 'goods' ? 2 : 1)
  const phoneCents = scenario === 'batch' ? 30003 : scenario === 'single' ? 10001 : 0
  assert.equal(Math.round(submitted.payment_info.payment_amount * 100), phoneCents + 5900)
  await page.evaluate(() => window.reopen())
  await page.waitForFunction(() => document.body.textContent.includes('添加商品') && !document.body.textContent.includes('正在读取销售门店'))
  await select(page, '商品名称', '原装充电器', 0)
  await page.evaluate(() => window.fixture.denied.push('accessories:view'))
  await page.waitForFunction(() => document.body.textContent.includes('缺少销售必要字段'))
  assert.equal(await page.$('textarea'), null, '撤权后不能继续展示结算草稿')
  assert.equal(await (await button(page, '确认整单结算')).evaluate(element => element.disabled), true)
}

async function sourceField(page, scope, label) {
  for (const group of await page.$$(`${scope} .form-group`)) {
    const text = await group.$eval('label', element => element.textContent.trim()).catch(() => '')
    if (text === label) return group
  }
  assert.fail(`原销售表单缺少 ${label}`)
}

export async function verifySalesPage(page, scenario) {
  await page.waitForSelector('.sales-view .device-card, .sales-view .el-table__row')
  if (scenario === 'goods') {
    await clickButton(page, '销售商品')
  } else {
    if (scenario === 'batch') {
      await clickButton(page, '单台')
      await clickButton(page, '表格')
      await clickVisible(await page.waitForSelector('.devices-table thead .el-checkbox'))
      await clickButton(page, '批量销售')
    } else {
      const card = await page.$('.device-card')
      if (card) {
        await clickVisible(await card.$('.device-title'), { count: 2 })
        await page.waitForSelector('.record-detail-dialog .tf-record-details')
        await clickButton(page, '出库')
      } else {
        const row = await page.$('.devices-table .el-table__row')
        let sale
        for (const action of await row.$$('button')) if (await action.evaluate(element => element.textContent.trim() === '出库')) sale = action
        await clickVisible(sale)
      }
    }
    const scope = scenario === 'batch' ? '.sales-batch-sale-dialog' : '.sales-sale-dialog'
    await page.waitForSelector(`${scope} input`)
    await fillInput(page, await page.$(`${scope} input[placeholder="请输入用户手机号"]`), '13900000001', { blur: false })
    await clickVisible(await page.waitForSelector('.customer-search-dropdown__item'))
    await page.waitForFunction(scope => document.querySelector(`${scope} .customer-name-lock-input input`)?.value === '样本客户', {}, scope)
    await selectItem(page, await sourceField(page, scope, scenario === 'batch' ? '销售店铺' : '销售门店'), '一店')
    await selectItem(page, await sourceField(page, scope, '销售员'), '样本销售员')
    await selectItem(page, await sourceField(page, scope, '支付方式'), '现金')
    if (scenario === 'batch') {
      const prices = await page.$$(`${scope} .batch-price-input input, ${scope} input[aria-label="销售价格"], ${scope} input[id^="batch-price-"]`)
      assert.equal(prices.length, 2, '必须逐台输入售价')
      for (const [index, control] of prices.entries()) await fillInput(page, control, index ? '200.02' : '100.01')
    } else {
      await fillInput(page, await page.$(`${scope} input[placeholder="请输入销售价格"]`), '100.01')
    }
    await fillInput(page, await page.$(`${scope} textarea`), '原表单整批备注')
    const posts = await postCount(page, '/sales/checkout')
    await clickButton(page, '配件')
    await page.waitForFunction(() => document.body.textContent.includes('手机与商品一起结算'))
    assert.equal(await postCount(page, '/sales/checkout'), posts, '打开配件不能提前销售手机')
    assert.equal(await (await field(page, '客户姓名')).$eval('input', element => element.value), '样本客户')
    assert.equal(await (await field(page, '客户姓名')).$eval('input', element => element.readOnly), true, '原客户姓名锁必须沿用')
    assert.equal(await (await field(page, '整单备注 / 收费库存转赠送原因')).$eval('textarea', element => element.value), '原表单整批备注')
    await clickButton(page, '取消')
    await page.waitForFunction(() => !document.body.textContent.includes('手机与商品一起结算'))
    assert.equal(await page.$eval(`${scope} textarea`, element => element.value), '原表单整批备注', '取消配件不得清空原手机草稿')
    await clickButton(page, '配件')
  }
  await page.waitForFunction(() => document.body.textContent.includes('添加商品'))
  if (scenario === 'goods') {
    await input(page, '客户手机号', '13900000001')
    await clickVisible(await page.waitForSelector('.customer-search-dropdown__item'))
    await select(page, '销售门店', '一店')
    await select(page, '支付方式', '现金')
  }
  await select(page, '商品名称', '原装充电器', 0)
  if (scenario === 'batch') await select(page, '关联手机', '手机甲', 0)
  await clickButton(page, '添加商品')
  await select(page, '商品名称', '赠膜', 1)
  await select(page, '出库方式', '赠送', 1)
  if (scenario === 'batch') await select(page, '关联手机', '手机乙', 1)
  const count = await page.evaluate(() => window.fixture.pageReads.filter(row => row.url === '/sales/phones/available').length)
  await clickButton(page, '确认整单结算')
  await page.waitForFunction(count => window.fixture.success.length === 1 && window.fixture.pageReads.filter(row => row.url === '/sales/phones/available').length > count && !document.body.textContent.includes('确认整单结算'), {}, count)
  await page.waitForFunction(() => [...document.querySelectorAll('.sales-sale-dialog, .sales-batch-sale-dialog')]
    .every(element => !element.checkVisibility()))
  const result = await page.evaluate(() => JSON.parse(JSON.stringify({
    posted: window.fixture.posts.filter(row => row.url === '/sales/checkout'),
    lastRead: window.fixture.pageReads.filter(row => row.url === '/sales/phones/available').at(-1),
    remaining: window.inventory.map(row => row.id)
  })))
  assert.equal(result.posted.length, 1)
  const data = result.posted[0].data
  assert.deepEqual(data.phones, scenario === 'batch' ? [{ phone_id:11,sale_price:100.01 },{ phone_id:12,sale_price:200.02 }] : scenario === 'single' ? [{ phone_id:11,sale_price:100.01 }] : [])
  assert.deepEqual(data.accessories.map(row => row.linked_phone_id), scenario === 'batch' ? [11,12] : scenario === 'single' ? [11,11] : [undefined,undefined])
  assert.deepEqual(data.accessories.map(row => [row.accessory_id,row.quantity,row.sale_type,row.unit_price]), [[56,1,'sale',30],[57,1,'gift',0]])
  assert.deepEqual(data.customer_info, { name:'样本客户',phone:'13900000001' })
  if (scenario !== 'goods') assert.equal(data.remarks, '原表单整批备注')
  assert.equal(result.lastRead.config.useCache, false, '成功后必须跳过旧库存缓存')
  assert.deepEqual(result.remaining, scenario === 'batch' ? [] : scenario === 'single' ? [12] : [11,12])
  await page.evaluate(() => window.fixture.denied.push('accessories:create', 'accessories:gift'))
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '销售商品'))
}

export async function verifyQuickSale(page) {
  await page.waitForSelector('.quick-sale-dialog input')
  await select(page, '品牌', '苹果')
  await select(page, '型号', '手机甲')
  await select(page, '颜色', '黑色')
  await select(page, '内存', '128G')
  await input(page, '序列号', 'QUICK0001')
  await input(page, 'IMEI', '012345678901234')
  await select(page, '供应商', '手机供应商')
  await select(page, '店铺', '一店')
  await input(page, '入库价格', '80.01')
  await input(page, '销售价格', '100.02')
  await fillInput(page, await (await field(page, '客户手机')).$('input'), '13900000001', { blur: false })
  await clickVisible(await page.waitForSelector('.customer-search-dropdown__item'))
  await page.waitForFunction(() => document.querySelector('.quick-sale-dialog .customer-name-lock-input input')?.value === '样本客户')
  await select(page, '支付方式', '现金')
  await input(page, '备注', '快速出库公共备注')
  await clickButton(page, '配件')
  await page.waitForFunction(() => document.body.textContent.includes('添加商品'))
  assert.equal(await postCount(page, '/sales/checkout'), 0, '打开配件不能提前销售新手机')
  assert.equal(await (await field(page, '整单备注 / 收费库存转赠送原因')).$eval('textarea', element => element.value), '快速出库公共备注')
  // 下层和结算窗口都有客户姓名；明确检查当前结算窗口继承的姓名锁。
  const names = await page.$$('.customer-name-lock-input input')
  assert.equal(await names.at(-1).evaluate(element => element.value), '样本客户')
  assert.equal(await names.at(-1).evaluate(element => element.readOnly), true)
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.body.textContent.includes('手机与商品一起结算'))
  assert.equal(await (await field(page, '销售价格')).$eval('input', element => element.value), '100.02')
  assert.equal(await page.$eval('.quick-sale-dialog textarea', element => element.value), '快速出库公共备注')
  await input(page, '销售价格', '150.03')
  await clickButton(page, '配件')
  await page.waitForFunction(() => document.body.textContent.includes('添加商品'))
  await select(page, '商品名称', '原装充电器', 0)
  await clickButton(page, '添加商品')
  await select(page, '商品名称', '赠膜', 1)
  await select(page, '出库方式', '赠送', 1)
  await clickButton(page, '确认整单结算')
  await page.waitForFunction(() => window.fixture.success.length === 1 && window.fixture.open === false)
  await page.waitForFunction(() => [...document.querySelectorAll('.quick-sale-dialog')].every(element => !element.checkVisibility()))
  const posts = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts)))
  assert.deepEqual(posts.map(row => row.url), ['/sales/checkout'], '只能提交共同结算，不能另发旧手机出库')
  const data = posts[0].data
  assert.deepEqual(data.phones, [])
  assert.deepEqual(data.quick_phone, { brand_id:1,model_id:1,color_id:1,memory_id:1,supplier_id:1,is_new:1,
    imei:'012345678901234',serial_number:'QUICK0001',purchase_cost:80.01,sale_price:150.03,
    inventory_time:data.quick_phone.inventory_time })
  assert.match(data.quick_phone.inventory_time, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(data.store_id, 1); assert.equal(data.operator_id, 7)
  assert.deepEqual(data.customer_info, { name:'样本客户',phone:'13900000001' })
  assert.equal(data.remarks, '快速出库公共备注')
  assert.deepEqual(data.accessories.map(row => [row.accessory_id,row.quantity,row.sale_type,row.unit_price,row.linked_phone_id]),
    [[56,1,'sale',30,1],[57,1,'gift',0,1]])
  assert.equal(data.payment_info.payment_amount, 180.03)
}
