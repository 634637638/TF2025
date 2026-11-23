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
const goods=[{id:56,name:'原装充电器',brand_name:'实际品牌',product_model:'MWVW3CH',category:'充电头',barcode:'000123',sale_price:30,quantity:100,serial_quantity:2},
{id:57,name:'赠膜',brand_name:'膜品牌',product_model:'通用',category:'钢化膜',barcode:'000124',sale_price:5,quantity:100,serial_quantity:0},
{id:58,name:'摩登仕M200',brand_name:'摩登仕',product_model:'M200 Ultra',category:'无线耳机',barcode:'6979263330138',sale_price:99,quantity:19,unit:'副',serial_quantity:0}];
window.mockRead=(url,config)=>{
  if(url.startsWith('/query/goods/')&&url.endsWith('/order'))return {success:true,data:window.fixture.lastOrder};
  if(url==='/sales/checkout/customer-summary')return {success:true,data:{member_number:'VIP001',points:1000,available_points:1000,balance:25}};
  if(!['/accessories/sale-options','/query/goods/sale-options'].includes(url))throw Error('未登记的隔离读取');
  window.fixture.reads.push(structuredClone(config.params));
  const rows=config.params.search_mode==='serial' ? ['00AAA','00BBB'].filter(sn=>!config.params.search||(config.params.match_mode==='exact'?sn===config.params.search:sn.includes(config.params.search))).map(serial_number=>({...goods[0],serial_number,quantity:1,serial_quantity:1})) : goods.filter(row=>!config.params.search||(config.params.match_mode==='exact'?row.barcode===config.params.search:[row.name,row.category,row.barcode,row.product_model].some(value=>value.includes(config.params.search))));
  return {success:true,data:{data:rows,pagination:{total:rows.length}}};
};
window.mockPost=async(url,input)=>{
  const data=JSON.parse(JSON.stringify(input));window.fixture.posts.push({url,data});
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseCheckout=done)}
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离提交结果未知')}
  const gross=(data.quick_phone?Math.round(data.quick_phone.sale_price*100):0)+data.phones.reduce((sum,row)=>sum+Math.round(row.sale_price*100),0)+data.accessories.reduce((sum,row)=>sum+Math.round(row.unit_price*100)*row.quantity,0);
  const lines=data.accessories.map((row,index)=>({key:'goods:'+row.key,points_used:data.auto_redeem&&!window.fixture.zeroRedemption&&index===data.accessories.findIndex(item=>item.sale_type==='sale')?Math.min(10,Math.floor(row.unit_price*row.quantity*10)):(row.redeem_points||0)}));
  const points=lines.reduce((sum,row)=>sum+row.points_used,0);
  if(url==='/sales/checkout/quote')return {success:true,data:{available_points:window.fixture.zeroRedemption?0:1000,balance:1000,redemption_ready:true,points_per_yuan:10,
    points_used:points,points_awarded:1,deduction_cents:points*10,gross_cents:gross,payable_cents:gross-points*10,balance_after:1000-points,lines}};
  if(url!=='/sales/checkout')throw Error('未登记的隔离提交');
  const orderItems=data.accessories.map((row,index)=>{
    const product=goods.find(item=>item.id===row.accessory_id),deduction=(row.redeem_points||0)/10;
    return {id:201+index,item_type:'accessory',sale_no:'ISOLATED-AS'+index,linked_phone_sale_no:null,sale_type:row.sale_type,
      name:product.name,brand_name:product.brand_name,product_model:product.product_model,color_name:null,memory:null,imei:null,
      serial_numbers:row.serial_numbers||[],unit:'个',quantity:row.quantity,unit_price:row.unit_price,gross_amount:row.quantity*row.unit_price,
      total_amount:row.quantity*row.unit_price-deduction,points_used:row.redeem_points||0,deduction_amount:deduction,points_awarded:0,
      gift_return_unit_price:row.sale_type==='gift'?row.gift_return_unit_price:null,
      gift_return_total:row.sale_type==='gift'?row.gift_return_unit_price*row.quantity:null,gift_agreement_state:row.sale_type==='gift'?'recorded':null};
  });
  if(!data.phones.length&&!data.quick_phone){
    window.fixture.lastOrder={id:9,order_no:'ISOLATED-SO9',customer_name:data.customer_info.name,customer_phone:data.customer_info.phone,
      store_name:data.store_id===1?'一店':'二店',operator_name:'样本销售员',sale_time:data.sale_time,remarks:data.remarks||'',
      total_amount:gross/100,final_amount:(gross-points*10)/100,paid_amount:(gross-points*10)/100,
      deduction_amount:points/10,points_used:points,points_awarded:0,items:orderItems};
  }
  return {success:true,data:{order_id:9,order_no:'ISOLATED-SO9',items:orderItems.map((item,index)=>({id:item.id,type:'accessory',accessory_sale_id:81+index})),
    payment_ids:[],total_amount:gross/100,paid_amount:(gross-points*10)/100,deduction_amount:points/10,points_earned:0,points_used:points}};
};
applyDeviceRootClass();
`

export const salesCheckoutEntry = `${salesEnvironment}
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import InlineLoading from '/src/components/InlineLoading.vue';
import {vTFLoading} from '/src/directives/index.ts';
import {vIdentifierInput} from '/src/directives/identifier-input.ts';
const {default:Checkout}=await import('/src/views/sales/page/SalesGoodsCheckoutDialog.vue');
const {useAdditionalGoodsCheckout}=await import('/src/composables/useAdditionalGoodsCheckout.ts');
const open=ref(true);
window.reopen=()=>{open.value=true};
const app=createApp({setup(){
  const additional=useAdditionalGoodsCheckout();
  const defaults=reactive({customer_name:'样本客户',customer_phone:'13900000001',store_id:1,operator_id:7,sale_time:'2026-11-14',payment_method:'cash',remarks:selectedPhones.length?'整批一个备注':''});
  const submit=async()=>{const result=await additional.submit(defaults,selectedPhones);if(result){window.fixture.success.push(result);window.fixture.open=false;additional.reset()}};
  return ()=>h('div',[
    selectedPhones.length&&!open.value?h('section',{class:'fixture-sale'},[
      h('input',{'aria-label':'最终销售日期',type:'text',value:defaults.sale_time,disabled:additional.locked.value,onInput:event=>{defaults.sale_time=event.target.value}}),
      additional.uncertain.value?h('p','提交结果尚未确认'):null,
      h('button',{disabled:additional.locked.value,onClick:()=>{open.value=true}},'编辑附加商品'),
      h('button',{disabled:additional.saving.value,onClick:submit},'确认销售')]):null,
    h(Checkout,{modelValue:open.value,'onUpdate:modelValue':value=>{open.value=value;if(!selectedPhones.length)window.fixture.open=value},
      phones:selectedPhones,defaults,initialSelection:additional.selection.value,
      onConfirm:draft=>{additional.save(draft);if(draft?.remarks!==undefined)defaults.remarks=draft.remarks},
      onSuccess:value=>window.fixture.success.push(value)})]);
}});
app.use(createPinia());app.use(ElementPlus);app.component('MobileDialog',MobileDialog);app.component('SectionLoading',SectionLoading);
app.component('AmountInput',AmountInput);app.component('PaymentMethodSelect',PaymentMethodSelect);app.component('PaymentChannelSelect',PaymentChannelSelect);
app.component('RecordDescriptions',RecordDescriptions);app.component('DataEmptyState',DataEmptyState);app.component('InlineLoading',InlineLoading);
app.directive('tf-loading',vTFLoading);app.directive('identifier-input',vIdentifierInput);
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
    // 相机硬件作为隔离边界；识别结果仍进入正式扫码队列，不访问设备或真实业务接口。
    [resolve(root, 'src/components/OptimizedScanner.vue'), `<script>import {h,ref} from 'vue';export default {
      props:{visible:Boolean},emits:['success','update:visible','manual'],setup(_props,{emit}){
        const code=ref('');const confirm=()=>{emit('success',code.value);emit('update:visible',false)};
        return ()=>h('div',{class:'fixture-product-scanner'},[
          h('input',{'aria-label':'隔离相机识别结果',value:code.value,onInput:event=>code.value=event.target.value,onKeydown:event=>{if(event.key==='Enter'){event.preventDefault();confirm()}}}),
          h('button',{onClick:confirm},'确认识别')])
      }};</script>`],
    [resolve(root, 'src/utils/unified-api.ts'), 'export const unifiedApi={get:async(url,config)=>window.mockRead(url,config),post:(url,data)=>window.mockPost(url,data)};export default unifiedApi'],
    [resolve(root, 'src/stores/auth.ts'), 'export const useAuthStore=()=>({user:{id:7,name:"样本销售员",username:"fixture"},isAdmin:false,hasPermission:value=>!window.fixture.denied.includes(value),fetchUserInfo:async()=>{}})'],
    [resolve(root, 'src/composables/usePagePermissions.ts'), `import {computed} from 'vue';export const usePagePermissions=module=>({
      canView:computed(()=>!window.fixture.denied.includes(module+':view')),canCreate:computed(()=>!window.fixture.denied.includes(module+':create')),
      canSell:computed(()=>!window.fixture.denied.includes(module+':sell')),canEdit:computed(()=>Boolean(window.fixture.editable)),canDelete:computed(()=>false),canExport:computed(()=>false),
      handleNoPermission:()=>{},hasPermission:action=>!window.fixture.denied.includes(module+':'+action)})`],
    [resolve(root, 'src/composables/useFieldPermissions.ts'), 'export const fieldPermissions={init:async()=>{},isFieldEditable:()=>true,isFieldVisible:(_module,field)=>!window.fixture.hidden.includes(field),getHiddenFields:()=>window.fixture.hidden};export const shouldShowActionColumn=(visible,actions)=>visible||actions.some(Boolean)'],
    [resolve(root, 'src/composables/usePermissionPreload.ts'), 'export const usePermissionPreload=()=>({preloadPermissions:async()=>{}})'],
    [resolve(root, 'src/composables/useNotification.ts'), 'export const useNotification=()=>Object.fromEntries(["success","error","warning","info"].map(type=>[type,message=>window.fixture.notices.push({type,message})]));export const notifications=useNotification()'],
    [resolve(root, 'src/services/reference-options.ts'), `export const getStores=async()=>({success:true,data:[{id:1,name:'一店',status:1},{id:2,name:'二店',status:1}]});
      export const searchOperators=async()=>({success:true,data:[{id:7,name:'样本销售员',username:'fixture'}]});
      export const getCachedBrands=async()=>({success:true,data:[{id:1,name:'苹果'}]});
      export const getModels=async()=>({success:true,data:[{id:1,name:'手机甲',brand_id:1},{id:2,name:'手机乙',brand_id:1}]});
      export const getCachedColors=async()=>({success:true,data:[{id:1,name:'黑色'}]});
      export const getCachedMemories=async()=>({success:true,data:[{id:1,name:'128G',size:'128G'}]});
      export const getCachedSuppliers=async()=>({success:true,data:[{id:1,name:'手机供应商'}]});
      export const getCachedQueryOptions=async()=>({success:true,data:{stores:[{id:1,name:'一店'}],brands:[],suppliers:[],users:[],statuses:[]}});
      export const searchEmployees=async()=>({success:true,data:[{id:7,name:'样本销售员'}]});
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
    let previous = null, stableFrames = 0
    do {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const rect = element.getBoundingClientRect()
      target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      const position = [rect.x, rect.y, rect.width, rect.height].join(',')
      // 用实际位置和命中结果等待控件稳定；不将不影响命中的透明度等动画误判为遮挡。
      stableFrames = previous === position ? stableFrames + 1 : 0
      previous = position
      if ((element === target || element.contains(target)) && stableFrames >= 2) return null
    } while (performance.now() < deadline)
    const rect = element.getBoundingClientRect()
    return { field: element.closest('.el-form-item')?.textContent || element.textContent,
      target: target?.outerHTML.slice(0, 300), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      viewport: [innerWidth, innerHeight], scroll: [scrollX, scrollY] }
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
  // 等待下拉展开及 Popper 定位完成再滚动长列表，避免过渡期间的裁切位置误导 scrollIntoView。
  await page.$eval(`#${listId}`, async element => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await Promise.all((element.closest('.el-popper')?.getAnimations({ subtree: true }) || []).map(animation => animation.finished.catch(() => {})))
  })
  const options = await page.$$(selector)
  for (const option of options) if (await option.evaluate((element, choice) => element.checkVisibility() && element.textContent.trim().includes(choice), choice)) {
    const selected = await option.evaluate(element => element.getAttribute('aria-selected'))
    await clickVisible(option)
    await page.waitForFunction((element, selected, listId) => element.getAttribute('aria-selected') !== selected ||
      [...document.querySelectorAll('input[aria-controls]')].some(control => control.getAttribute('aria-controls') === listId && control.getAttribute('aria-expanded') === 'false'), {}, option, selected, listId)
    if (await item.$eval('input[aria-controls]', element => element.getAttribute('aria-expanded') === 'true')) await page.keyboard.press('Escape')
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(element => !element.checkVisibility()), {}, selector)
    const nowSelected = await option.evaluate(element => element.getAttribute('aria-selected') === 'true')
    assert.equal(await item.$eval('.el-select', (element, choice) => element.textContent.includes(choice), choice), nowSelected,
      nowSelected ? `选中后须回显${choice}` : `取消后须移除${choice}`)
    return
  }
  assert.fail(`没有找到选项 ${choice}`)
}

async function button(page, label, scope = '') {
  for (const item of (await page.$$(`${scope} button`)).reverse()) if (await item.evaluate((element, label) => element.checkVisibility() && element.textContent.trim() === label, label)) return item
  assert.fail(`没有找到按钮 ${label}`)
}

async function clickButton(page, label) { await clickVisible(await button(page, label)) }

export { clickVisible, button, clickButton, field, input, select, checkBoundaries }

async function postCount(page, url) { return page.evaluate(url => window.fixture.posts.filter(row => row.url === url).length, url) }

async function assertBlockedSubmit(page, message) {
  const count = await postCount(page, '/sales/checkout')
  const label = await page.evaluate(() => [...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '确认添加') ? '确认添加' : '确认收款')
  await clickButton(page, label)
  await page.waitForFunction(message => window.fixture.notices.at(-1)?.message.includes(message), {}, message)
  assert.equal(await postCount(page, '/sales/checkout'), count)
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
  const clipped = await page.$$eval('.checkout-additional-goods td .el-input-number', controls => controls.filter(control => {
    const box = control.getBoundingClientRect(), cell = control.closest('td').getBoundingClientRect()
    return box.width > cell.width || box.left < cell.left || box.right > cell.right
  }).map(control => control.outerHTML.slice(0, 200)))
  assert.deepEqual(clipped, [], '公共数量与价格控件不得超出单元格')
}

export async function verifySalesCheckout(page, scenario, capture = async () => {}) {
  if (scenario !== 'goods') return verifyAdditionalCheckout(page, scenario, capture)
  await page.waitForSelector('.cashier-workspace')
  // 等弹窗入场过渡结束后再跨控件测量，避免先后读到不同动画帧的位置。
  await page.waitForFunction(() => {
    document.querySelector('.cashier-workspace').getBoundingClientRect()
    return document.getAnimations().every(animation => animation.playState !== 'running' || animation.effect.getComputedTiming().iterations === Infinity)
  })
  const searchLayout = await page.$$eval('.cashier-search .el-form-item', fields => ({
    width: innerWidth,
    fields: fields.map(field => {
      const box = field.getBoundingClientRect()
      return { label: field.querySelector('.el-form-item__label').textContent.trim(), top: box.top, bottom: box.bottom, left: box.left, right: box.right }
    })
  }))
  assert.deepEqual(searchLayout.fields.map(field => field.label), ['销售门店', '销售员', '商品检索'])
  const [storeField, sellerField, searchField] = searchLayout.fields
  if (searchLayout.width > 1024) assert.ok(Math.abs(storeField.top - searchField.top) < 2 && Math.abs(storeField.top - sellerField.top) < 2 && sellerField.left >= storeField.right && searchField.left >= sellerField.right, 'PC端销售门店、销售员和商品检索须同行且不重叠')
  else if (searchLayout.width <= 767) assert.ok(Math.abs(storeField.top - sellerField.top) < 2 && searchField.top >= Math.max(storeField.bottom, sellerField.bottom), '手机端门店和销售员同行，商品检索整行保留可操作宽度')
  if (searchLayout.width > 1024) {
    assert.ok(searchField.right - searchField.left > 2 * (storeField.right - storeField.left), 'PC端商品检索须比门店和销售员选择框更宽')
    assert.equal(await page.$('input[aria-label="商品扫码输入"]'), null, 'PC端不展示独立条码/SN输入区')
    const scanBox = await (await button(page, '扫码')).boundingBox()
    const inputBox = await (await page.$('input[aria-label="收银商品检索"]')).boundingBox()
    assert.ok(Math.abs(scanBox.y + scanBox.height / 2 - inputBox.y - inputBox.height / 2) < 2 && scanBox.x >= inputBox.x + inputBox.width, 'PC端扫码按钮应位于商品检索右侧并水平居中')
  } else assert.ok(await page.$('input[aria-label="商品扫码输入"]'), '手机和平板保留扫码录入区')
  const controls = await page.$eval('.cashier-search-controls', toolbar => [...toolbar.children].map(child => {
    const box = child.getBoundingClientRect()
    return { left: box.left, right: box.right, center: box.top + box.height / 2 }
  }))
  assert.ok(controls.every(control => Math.abs(control.center - controls[0].center) < 2), '商品输入、检索及扫码控件须同行对齐')
  const gaps = controls.slice(1).map((control, index) => control.left - controls[index].right)
  assert.ok(gaps.every(gap => gap > 0 && Math.abs(gap - gaps[0]) < 1), '输入、检索及扫码之间应保留一致间距，不能粘连')
  assert.equal(await page.$eval('.cashier-products', catalog => getComputedStyle(catalog).scrollbarWidth), 'none', '商品列表隐藏可见滚动条')
  const catalogScroll = await page.$('.cashier-products')
  // 用临时占位制造溢出，仅验证原生滚轮，不改写商品数据或业务草稿。
  await catalogScroll.evaluate(catalog => {
    const spacer = document.createElement('div')
    spacer.dataset.scrollProbe = 'true'
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.height = `${innerHeight * 2}px`
    catalog.append(spacer)
  })
  try {
    await catalogScroll.hover()
    await page.mouse.wheel({ deltaY: 160 })
    await page.waitForFunction(() => document.querySelector('.cashier-products').scrollTop > 0)
  } finally {
    await catalogScroll.evaluate(catalog => { catalog.querySelector('[data-scroll-probe]').remove(); catalog.scrollTop = 0 })
  }
  const choose = async (name, keyword) => {
    await fillInput(page, await page.$('input[aria-label="收银商品检索"]'), keyword, { blur: false })
    await page.keyboard.press('Enter')
    await page.waitForFunction(name => [...document.querySelectorAll('.cashier-product button')].some(element => element.textContent.trim() === name), {}, name)
    await clickButton(page, name)
    const cards = await page.$$('.cashier-product')
    for (const card of cards) if (await card.$eval('button', (element, name) => element.textContent.trim() === name, name)) {
      await clickVisible(await card.$('button[aria-label^="加入"]')); break
    }
  }
  const scan = async code => {
    const readCount = await page.evaluate(() => window.fixture.reads.filter(row => row.match_mode === 'exact').length)
    if (searchLayout.width > 1024) {
      await clickButton(page, '扫码')
      await page.waitForSelector('.fixture-product-scanner')
    }
    const scanInput = await page.$(`input[aria-label="${searchLayout.width > 1024 ? '隔离相机识别结果' : '商品扫码输入'}"]`)
    await fillInput(page, scanInput, code, { blur: false })
    await page.keyboard.press('Enter')
    await page.waitForFunction(count => window.fixture.reads.filter(row => row.match_mode === 'exact').length > count && !document.querySelector('.checkout-additional-goods .inline-loading'), {}, readCount)
  }
  await choose('原装充电器', '充电头')
  assert.equal(await page.evaluate(() => window.fixture.reads.some(row => row.search === '充电头')), true, '商品类型未通过正式API检索')
  assert.equal(await page.$eval('.cashier-order', element => element.textContent.includes('MWVW3CH')), true, '右侧缺少商品规格')
  const descriptionLayout = await page.$eval('.cashier-selection', section => {
    const sectionBox = section.getBoundingClientRect()
    const fields = [...section.querySelectorAll('.el-descriptions__label')].filter(field => field.textContent.trim())
    const stockCells = ['条形码', '零售价', '可售数量'].map(label => fields.find(field => field.textContent.trim() === label)?.closest('td').getBoundingClientRect())
    return {
      wideLabels: fields.filter(field => field.closest('td').colSpan === 2).map(field => field.textContent.trim()),
      labels: fields.map(field => field.textContent.trim()),
      horizontal: fields.every(field => field.nextElementSibling?.classList.contains('el-descriptions__content')),
      fontSize: Math.max(...fields.map(field => Number.parseFloat(getComputedStyle(field).fontSize))),
      stockInline: stockCells.every(cell => cell && Math.abs(cell.top - stockCells[0].top) < 2) && stockCells.slice(1).every((cell, index) => cell.left >= stockCells[index].right - 1),
      overflow: [...section.querySelectorAll('.el-descriptions__cell')].some(cell => {
        const box = cell.getBoundingClientRect()
        return box.left < sectionBox.left - 1 || box.right > sectionBox.right + 1 || cell.scrollWidth > cell.clientWidth + 1
      })
    }
  })
  assert.ok(['配件型号', '条形码'].every(label => descriptionLayout.wideLabels.includes(label)), '型号和条形码应整行展示，避免挤压其他字段')
  assert.equal(descriptionLayout.horizontal, true, '商品资料标签与内容须横向同行展示')
  assert.ok(['商品类型', '颜色', '品牌', '单位'].every(label => !descriptionLayout.labels.includes(label)), '类型、颜色、品牌和单位保留内容且不显示字段名')
  assert.equal(await page.$eval('.cashier-selection', section => section.textContent.includes('实际品牌')), true, '移除品牌字段名后仍须保留品牌内容')
  assert.ok(descriptionLayout.fontSize <= 13, '商品资料使用公共紧凑字号')
  assert.equal(descriptionLayout.stockInline, true, '零售价和可售数量应位于条形码右侧并同排显示')
  assert.equal(descriptionLayout.overflow, false, '商品资料字段不得超出详情容器或截断')
  await page.$eval('.cashier-selection', element => element.scrollIntoView({ block: 'start' }))
  await capture('selection')
  const addButton = await button(page, '加入清单')
  await addButton.scrollIntoView()
  const addBox = await addButton.boundingBox(), saleBox = await (await (await field(page, '出库方式')).$('.el-select')).boundingBox()
  assert.ok(addBox.x >= saleBox.x + saleBox.width && Math.abs(addBox.y + addBox.height / 2 - saleBox.y - saleBox.height / 2) < 2, '出库方式选择框和加入清单按钮须水平同行且不重叠')
  assert.equal(await addButton.evaluate(element => {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--tf-button-height-small);background:var(--tf-button-primary-bg)'
    element.append(probe)
    try {
      return element.classList.contains('tf-button--save') &&
        Math.abs(element.getBoundingClientRect().height - probe.getBoundingClientRect().height) < 1 &&
        getComputedStyle(element).backgroundColor === getComputedStyle(probe).backgroundColor
    } finally { probe.remove() }
  }), true, '加入清单须采用全局主操作按钮及small响应式尺寸')
  assert.equal(await (await button(page, '清空')).evaluate(element => element.classList.contains('el-button--small')), true, '清空须采用公共small尺寸')
  assert.equal(await page.$$eval('.cashier-order .el-form-item__label', labels => labels.some(label => label.textContent.trim() === '操作')), false, '独立收银不显示多余操作标签')
  await capture('selection-actions')
  await select(page, '销售门店', '二店')
  await page.waitForFunction(() => document.querySelectorAll('.checkout-additional-goods .cashier-cart-line').length === 0)
  await scan('000123'); await scan('000123')
  assert.equal(await page.$eval('input[aria-label="原装充电器数量"]', element => element.value), '2', '连续扫码应累加普通数量')
  assert.equal(await page.$$eval('.cashier-product', cards => cards.find(card => card.textContent.includes('原装充电器')).textContent.includes('可售 98')), true,
    '候选可售应扣除清单中连续扫码加入的数量')
  assert.equal(await page.evaluate(() => window.fixture.reads.filter(row => row.match_mode === 'exact').every(row => row.store_id === 2)), true)
  assert.equal(await page.$('input[aria-label="原装充电器抵扣积分"]'), null, '选购阶段不提供积分输入')
  const layout = await page.evaluate(() => {
    const left = document.querySelector('.cashier-catalog').getBoundingClientRect(), right = document.querySelector('.cashier-order').getBoundingClientRect()
    return { viewport: innerWidth, left: { x: left.x, y: left.y, right: left.right, bottom: left.bottom }, right: { x: right.x, y: right.y } }
  })
  if (layout.viewport > 1024) assert.ok(layout.right.x >= layout.left.right, '桌面商品详情及清单应位于右侧')
  else assert.ok(layout.right.y >= layout.left.bottom, '手机商品详情及清单应在候选区下方')
  const productLayout = await page.$$eval('.cashier-product', cards => {
    const card = cards.find(element => element.textContent.includes('摩登仕M200'))
    const model = card.querySelector('[title^="型号："]'), barcode = card.querySelector('[title^="条形码："]')
    const modelBox = model.getBoundingClientRect(), barcodeBox = barcode.getBoundingClientRect(), cardBox = card.getBoundingClientRect()
    return { desktop: innerWidth > 1024, modelTop: modelBox.top, barcodeTop: barcodeBox.top,
      code: barcode.textContent.trim(), inside: barcodeBox.right <= cardBox.right && barcodeBox.left >= cardBox.left }
  })
  assert.equal(productLayout.code, '6979263330138', '完整保留13位条形码')
  assert.equal(productLayout.inside, true, '条形码不得超出卡片')
  const cartColor = await page.$eval('.cashier-product .tf-button--cart', button => {
    const sample = document.createElement('span')
    sample.style.color = 'var(--tf-button-cart-color)'
    button.append(sample)
    const expected = getComputedStyle(sample).color, actual = getComputedStyle(button).color
    sample.remove()
    return { expected, actual }
  })
  assert.equal(cartColor.actual, cartColor.expected, '购物车应显示公共橙色，不能被链接按钮默认蓝色覆盖')
  if (productLayout.desktop) assert.ok(Math.abs(productLayout.modelTop - productLayout.barcodeTop) < 2, '紧凑卡片应利用右侧空间并列显示型号和13位条形码')
  const saleTypeLayout = await page.$eval('.cashier-order .tf-form-field--inline', element => {
    const label = element.querySelector('.el-form-item__label').getBoundingClientRect()
    const control = element.querySelector('.el-select').getBoundingClientRect()
    return { label: { right: label.right, center: label.top + label.height / 2 }, control: { left: control.left, center: control.top + control.height / 2, width: control.width } }
  })
  assert.ok(saleTypeLayout.label.right < saleTypeLayout.control.left && Math.abs(saleTypeLayout.label.center - saleTypeLayout.control.center) < 2,
    '出库方式标签与选择框须同行且不重叠')
  assert.ok(saleTypeLayout.control.width > 80, '出库方式选择框应保留可操作宽度')
  const lineLayout = await page.$eval('.cashier-cart-line', element => {
    const fields = [...element.querySelectorAll('.cashier-cart-line__fields .el-form-item')].map(field => {
      const label = field.querySelector('.el-form-item__label').getBoundingClientRect(), input = field.querySelector('input').getBoundingClientRect()
      return { labelRight: label.right, labelCenter: label.top + label.height / 2, inputLeft: input.left, inputCenter: input.top + input.height / 2, inputWidth: input.width }
    })
    const subtotal = element.querySelector('.cashier-cart-line__subtotal'), totalBox = subtotal.getBoundingClientRect()
    const remove = element.querySelector('button[aria-label^="删除"]'), colorSample = document.createElement('span')
    colorSample.style.backgroundColor = 'var(--tf-button-danger-bg)'; remove.append(colorSample)
    const removeColor = getComputedStyle(remove).backgroundColor, expectedColor = getComputedStyle(colorSample).backgroundColor
    colorSample.remove()
    return { desktop: innerWidth > 1024, fields, total: subtotal.textContent, totalCenter: totalBox.top + totalBox.height / 2, removeColor, expectedColor }
  })
  assert.equal(lineLayout.fields.length, 2, '数量和销售价保留两个可编辑字段')
  assert.ok(lineLayout.fields.every(field => field.labelRight <= field.inputLeft && Math.abs(field.labelCenter - field.inputCenter) < 2 && field.inputWidth >= 32 && field.inputWidth <= 90), '数量及销售价的标签和输入框应各自同行，输入框保持紧凑且可编辑')
  assert.ok(Math.abs(lineLayout.fields[0].inputCenter - lineLayout.fields[1].inputCenter) < 2, '数量和销售价两组字段应水平并排')
  assert.ok(lineLayout.total.includes('60 元'), '商品行展示合计60元')
  assert.equal(lineLayout.removeColor, lineLayout.expectedColor, '删除应使用公共红色按钮')
  if (lineLayout.desktop) assert.ok(lineLayout.fields.every(field => Math.abs(field.inputCenter - lineLayout.totalCenter) < 2), '桌面数量、销售价及合计同行')
  await checkBoundaries(page)
  await capture('shopping')
  await page.$eval('.cashier-cart-line__fields', element => element.scrollIntoView({ block: 'center' }))
  await capture('cart-line')
  await clickButton(page, '确认结算')
  await page.waitForFunction(() => document.body.textContent.includes('可用积分：1000'))
  const customerFields = await page.$$eval('.checkout-payment .el-form-item__label', labels => labels.slice(0, 3).map(label => {
    const box = label.getBoundingClientRect()
    return { name: label.textContent.trim(), top: box.top }
  }))
  assert.deepEqual(customerFields.map(field => field.name), ['手机号', '姓名', '销售日期'], '结算基础信息名称及顺序')
  assert.equal(await page.$$eval('.checkout-payment .el-form-item__label', labels => labels.some(label => label.textContent.trim() === '销售员')), false, '商品结算不重复展示首页销售员')
  const desktopCheckout = await page.evaluate(() => innerWidth > 1024)
  if (desktopCheckout) assert.ok(customerFields.every(field => Math.abs(field.top - customerFields[0].top) < 2), '桌面基础信息同行展示')
  else assert.ok(Math.abs(customerFields[0].top - customerFields[1].top) < 2 && customerFields[2].top > customerFields[0].top, '手机基础信息短字段按顺序两列排列')
  assert.equal(await page.$$eval('.checkout-payment button', buttons => buttons.some(button => button.checkVisibility() && button.textContent.trim() === '积分试算')), false, '检索客户后直接提供积分抵扣，不要求单独试算')
  assert.equal(await page.$eval('.checkout-payment', payment => payment.textContent.includes('可用积分：1000')), true, '客户摘要加载后直接展示本次可用积分')
  assert.equal(await (await button(page, '积分抵扣')).evaluate(element => element.disabled), false, '有可用积分可直接点击抵扣')
  assert.equal(await (await button(page, '积分抵扣')).evaluate(element => {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--tf-button-small-base-height)'
    element.append(probe)
    try {
      return element.classList.contains('el-button--small') && Math.abs(element.getBoundingClientRect().height - probe.getBoundingClientRect().height) < 1
    } finally { probe.remove() }
  }), true, '积分抵扣须采用公共small尺寸，不被工具栏的默认高度覆盖')
  const cashInput = await page.$('input[aria-label="现金收取"]')
  assert.equal(await cashInput.evaluate(input => input.closest('.checkout-cash-row').querySelector('strong').textContent.trim()), '¥0', '未填写现金时默认显示找零¥0')
  await cashInput.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await capture('cash-empty')
  await fillInput(page, cashInput, '50')
  await page.waitForFunction(() => document.body.textContent.includes('还差 ¥10'))
  await fillInput(page, cashInput, '100')
  await page.waitForFunction(() => document.body.textContent.includes('退还 ¥40'))
  const cashLayout = await page.$eval('input[aria-label="现金收取"]', input => {
    const row = input.closest('.checkout-cash-row'), nodes = [...row.querySelectorAll('.el-form-item__label'), input, row.querySelector('strong')]
    const rowBox = row.getBoundingClientRect(), fields = [...row.querySelectorAll('.el-form-item')].map(field => field.getBoundingClientRect())
    return {
      controls: nodes.map(node => { const box = node.getBoundingClientRect(); return { center: box.top + box.height / 2, width: box.width } }),
      rowRight: rowBox.right, lastRight: fields.at(-1).right,
      firstLeft: fields[0].left, rowCenter: rowBox.left + rowBox.width / 2,
      inputWidth: input.closest('.el-input-number').getBoundingClientRect().width
    }
  })
  assert.ok(cashLayout.controls.every(box => box.width > 0 && Math.abs(box.center - cashLayout.controls[0].center) < 2), '现金收取、输入框、找零及退还/差额金额须水平同行')
  assert.ok(Math.abs(cashLayout.rowRight - cashLayout.lastRight) < 2, '现金收取及找零整组须靠右排列')
  assert.ok(cashLayout.inputWidth > 0 && cashLayout.inputWidth <= 160, '现金金额输入框应紧凑展示')
  if (desktopCheckout) assert.ok(cashLayout.firstLeft >= cashLayout.rowCenter, 'PC端现金收取与找零应位于右侧')
  await cashInput.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await checkBoundaries(page)
  await capture('cash')
  await fillInput(page, cashInput, '')
  await clickButton(page, '积分抵扣')
  await page.waitForFunction(() => document.body.textContent.includes('本单抵扣 10'))
  const ordinary = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts.at(-1).data.accessories[0])))
  assert.equal(ordinary.quantity, 2)
  assert.equal(ordinary.serial_numbers, undefined)
  await clickButton(page, '返回选购')
  await fillInput(page, await page.$('input[aria-label="原装充电器数量"]'), '3')
  await clickButton(page, '确认结算')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('本单抵扣 10')), false, '修改数量清除原抵扣')
  await clickButton(page, '返回选购')
  await clickVisible(await page.$('button[aria-label="删除原装充电器"]'))
  await scan('00AAA'); await scan('00AAA')
  await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('已加入清单'))
  await scan('00BBB')
  await page.waitForFunction(() => document.querySelectorAll('.checkout-additional-goods .cashier-cart-line').length === 2)
  assert.equal(await page.$eval('input[aria-label="原装充电器数量"]', element => element.disabled), true)
  assert.equal(await page.$('input[aria-label="原装充电器抵扣积分"]'), null, '选购阶段不提供积分输入')
  await select(page, '出库方式', '赠送')
  await choose('赠膜', '钢化膜')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('赠品未退回约定单价')), false)
  await clickButton(page, '确认结算')
  await input(page, '整单备注', '整批一个备注')
  await page.waitForFunction(() => document.body.textContent.includes('可用积分：1000'))
  await clickButton(page, '积分抵扣')
  await page.waitForFunction(() => document.body.textContent.includes('本单抵扣 10'))
  await checkBoundaries(page)
  await capture('payment')
  await page.evaluate(() => { window.fixture.failNext = true; window.fixture.holdNext = true })
  await clickButton(page, '确认收款')
  await page.waitForFunction(() => window.fixture.posts.some(row => row.url === '/sales/checkout'))
  assert.equal(await (await button(page, '确认收款')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), true)
  await page.evaluate(() => window.releaseCheckout())
  await page.waitForFunction(() => document.body.textContent.includes('提交结果尚未确认'))
  assert.deepEqual(await page.$$eval('.el-form input, .el-form textarea', elements => elements.filter(element => !element.disabled)
    .map(element => element.closest('.el-form-item')?.textContent)), [], '结果未知后应冻结全部销售草稿控件')
  assert.equal(await (await button(page, '返回选购')).evaluate(element => element.disabled), true)
  assert.equal(await page.$$eval('button', buttons => buttons.some(button => button.checkVisibility() && button.textContent.trim() === '积分试算')), false, '商品结算不提供单独积分试算按钮')
  assert.equal(await (await button(page, '取消抵扣')).evaluate(element => element.disabled), true)
  assert.equal(await (await button(page, '取消')).evaluate(element => element.disabled), false)
  await clickButton(page, '确认收款')
  await page.waitForFunction(() => window.fixture.success.length === 1 && document.body.textContent.includes('收款成功'))
  assert.equal(await page.evaluate(() => window.fixture.open), true, '成功后保留真实成交结果')
  await capture('success')
  await clickButton(page, '查看 / 打印凭证')
  await page.waitForSelector('.checkout-order-document')
  assert.equal(await page.$eval('.checkout-order-document', element => element.textContent.includes('00AAA') && element.textContent.includes('ISOLATED-SO9')), true, '凭证读取真实原单及SN')
  await checkBoundaries(page)
  await capture('receipt')
  await page.evaluate(() => {
    window.originalCashierOpen = window.open.bind(window)
    window.open = (...args) => {
      const popup = window.originalCashierOpen(...args)
      window.cashierPrint = popup
      popup.print = () => { window.cashierPrinted = true }
      return popup
    }
  })
  try {
    await clickButton(page, '打印凭证')
    await page.waitForFunction(() => window.cashierPrinted)
    const printed = await page.evaluate(() => ({
      text: window.cashierPrint.document.body.textContent,
      width: window.cashierPrint.document.documentElement.scrollWidth,
      viewport: window.cashierPrint.innerWidth
    }))
    for (const value of ['ISOLATED-SO9', '00AAA', '00BBB', '赠膜', '¥59']) assert.ok(printed.text.includes(value), `商品打印凭证缺少 ${value}`)
    assert.ok(printed.width <= printed.viewport + 1, '商品打印凭证横向溢出')
  } finally {
    await page.evaluate(() => { window.cashierPrint?.close(); window.open = window.originalCashierOpen })
    await page.bringToFront()
  }

  await clickButton(page, '关闭')
  await clickButton(page, '完成')
  await page.waitForFunction(() => !window.fixture.open)
  const submissions = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts.filter(row => row.url === '/sales/checkout').map(row => row.data))))
  assert.equal(submissions.length, 2)
  assert.deepEqual(submissions[0], submissions[1], '结果未知重试必须保留原幂等键和载荷')
  const submitted = submissions[0]
  assert.deepEqual(submitted.phones, [])
  assert.deepEqual(submitted.accessories.map(row => [row.accessory_id, row.sale_type, row.quantity, row.unit_price, row.linked_phone_id]),
    [[56, 'sale', 1, 30, undefined], [56, 'sale', 1, 30, undefined], [57, 'gift', 1, 0, undefined]])
  assert.deepEqual(submitted.accessories.slice(0, 2).flatMap(row => row.serial_numbers), ['00AAA', '00BBB'])
  assert.equal(submitted.accessories[0].redeem_points, 10)
  assert.equal(submitted.accessories[2].gift_return_unit_price, 5)
  assert.equal(submitted.remarks, '整批一个备注')
  assert.equal(submitted.store_id, 2)
  assert.equal(submitted.operator_id, 7)
  assert.equal(submitted.sale_time, '2026-11-14')
  assert.equal(submitted.payment_info.payment_method, 'cash')
  assert.equal(Math.round(submitted.payment_info.payment_amount * 100), 5900)
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-overlay-dialog.is-closing')].some(element => element.checkVisibility()))
  await page.evaluate(() => window.reopen())
  await page.waitForSelector('.cashier-workspace')
  await choose('原装充电器', '000123')
  await page.evaluate(() => window.fixture.denied.push('accessories:view', 'query:goods-view'))
  await page.waitForFunction(() => document.body.textContent.includes('缺少销售必要字段'))
  assert.equal(await page.$('textarea'), null, '撤权后不能继续展示结算草稿')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '确认结算')), false)
}

// 手机附加商品复用真实检索、表格输入及减号，禁止操作组件实例或内部草稿。
async function verifyAdditionalCheckout(page, scenario, capture) {
  await page.waitForSelector('.checkout-additional-goods')
  await checkInheritedSaleFields(page)
  await select(page, '附加商品', '原装充电器', undefined, '000123')
  if (scenario === 'batch') {
    await clickButton(page, '确认')
    await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('关联手机'))
    await select(page, '关联手机', '手机甲')
  }
  await clickButton(page, '确认')
  const quantity = await page.waitForSelector('input[aria-label="原装充电器数量"]')
  await fillInput(page, quantity, '')
  await assertBlockedSubmit(page, '正整数')
  await fillInput(page, quantity, '2')
  await fillInput(page, await page.$('input[aria-label="原装充电器价格"]'), '25.5')
  await page.evaluate(() => { window.fixture.zeroRedemption = true })
  await clickButton(page, '积分抵扣')
  await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('账户积分 1000，本次可抵扣积分为 0；未核对来源'))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('本单抵扣')), false, '未追溯余额不能作为实际抵扣')
  assert.equal(await postCount(page, '/sales/checkout'), 0, '零抵扣提示不能提前结算')
  await page.evaluate(() => { window.fixture.zeroRedemption = false })
  await clickButton(page, '积分抵扣')
  await page.waitForFunction(() => document.body.textContent.includes('本单抵扣 10'))
  await clickButton(page, '取消抵扣')
  await page.waitForFunction(() => !document.body.textContent.includes('本单抵扣'))
  await clickButton(page, '积分抵扣')
  await page.waitForFunction(() => document.body.textContent.includes('本单抵扣 10'))
  await fillInput(page, quantity, '3')
  await page.waitForFunction(() => !document.body.textContent.includes('本单抵扣'))
  const remove = await page.$('button[aria-label="删除原装充电器"]')
  assert.equal(await remove.evaluate(element => element.textContent.trim()), '')
  await clickVisible(remove)
  await page.waitForFunction(() => document.querySelectorAll('.checkout-additional-goods .el-table__row').length === 0)
  for (const sn of ['00AAA', '00BBB']) {
    await select(page, '附加商品', sn, undefined, sn)
    await clickButton(page, '确认')
    if (sn === '00AAA') {
      await select(page, '附加商品', sn, undefined, sn)
      await clickButton(page, '确认')
      await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('已加入清单'))
    }
  }
  assert.equal(await page.$eval('input[aria-label="原装充电器数量"]', element => element.disabled), true)
  await select(page, '附加商品', '赠膜', undefined, '赠膜')
  await select(page, '出库方式', '赠送')
  if (scenario === 'batch') await select(page, '关联手机', '手机乙')
  await clickButton(page, '确认')
  assert.equal(await page.$$eval('.el-form-item__label', elements => elements.some(element => element.textContent.trim() === '整单备注')), false, '附加商品继承手机主单备注，不重复录入')
  await clickButton(page, '积分抵扣')
  await page.waitForFunction(() => document.body.textContent.includes('本单抵扣 10'))
  await checkBoundaries(page); await capture()
  await clickButton(page, '确认添加')
  await page.waitForSelector('.fixture-sale')
  assert.equal(await postCount(page, '/sales/checkout'), 0, '确认添加只保存草稿，不能提前结算')
  assert.equal(await page.evaluate(() => window.fixture.success.length), 0)
  await clickButton(page, '编辑附加商品')
  await page.waitForFunction(() => document.querySelectorAll('.checkout-additional-goods .el-table__row').length === 3 && document.body.textContent.includes('本单抵扣 10'))
  await clickButton(page, '取消')
  await page.waitForSelector('.fixture-sale')
  await fillInput(page, await page.$('input[aria-label="最终销售日期"]'), '2026-11-13')
  await page.evaluate(() => { window.fixture.failNext = true; window.fixture.holdNext = true })
  await clickButton(page, '确认销售')
  await page.waitForFunction(() => window.fixture.posts.some(row => row.url === '/sales/checkout'))
    .catch(async error => { throw new Error(`外层最终确认未发送结算：${JSON.stringify(await page.evaluate(() => window.fixture.notices))}`, { cause: error }) })
  assert.equal(await (await button(page, '确认销售')).evaluate(element => element.disabled), true)
  await page.evaluate(() => window.releaseCheckout())
  await page.waitForFunction(() => document.body.textContent.includes('提交结果尚未确认'))
  assert.equal(await (await button(page, '编辑附加商品')).evaluate(element => element.disabled), true)
  assert.equal(await page.$eval('input[aria-label="最终销售日期"]', element => element.disabled), true)
  await clickButton(page, '确认销售')
  await page.waitForFunction(() => window.fixture.success.length === 1 && !window.fixture.open)
  const posts = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts.filter(row => row.url === '/sales/checkout').map(row => row.data))))
  assert.equal(posts.length, 2); assert.deepEqual(posts[0], posts[1])
  const data = posts[0]
  assert.deepEqual(data.phones.map(row => row.phone_id), scenario === 'batch' ? [11, 12] : [11])
  assert.deepEqual(data.accessories.map(row => [row.accessory_id, row.sale_type, row.quantity, row.unit_price]), [[56,'sale',1,30],[56,'sale',1,30],[57,'gift',1,0]])
  assert.deepEqual(data.accessories.slice(0,2).map(row => row.serial_numbers), [['00AAA'],['00BBB']])
  assert.deepEqual(data.accessories.map(row => row.linked_phone_id), scenario === 'batch' ? [11,11,12] : [11,11,11])
  assert.equal(data.accessories[0].redeem_points, 10)
  assert.equal(data.accessories[2].gift_return_unit_price, 5)
  assert.equal(Math.round(data.payment_info.payment_amount * 100), (scenario === 'batch' ? 30003 : 10001) + 5900)
  assert.equal(data.remarks, '整批一个备注')
  assert.equal(data.sale_time, '2026-11-13', '以外层最终确认时的日期提交')
  assert.equal(data.auto_redeem, undefined, '正式结算仅提交已核对逐行积分')
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-overlay-dialog.is-closing')].some(element => element.checkVisibility()))
  await page.evaluate(() => window.reopen())
  await page.waitForSelector('.checkout-additional-goods')
  await page.evaluate(() => window.fixture.denied.push('accessories:view', 'query:goods-view'))
  await page.waitForFunction(() => document.body.textContent.includes('缺少销售必要字段'))
  assert.equal(await (await button(page, '确认添加')).evaluate(element => element.disabled), true)
}

async function sourceField(page, scope, label) {
  for (const group of await page.$$(`${scope} .form-group`)) {
    const text = await group.$eval('label', element => element.textContent.trim()).catch(() => '')
    if (text === label) return group
  }
  assert.fail(`原销售表单缺少 ${label}`)
}

async function checkInheritedSaleFields(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog')].some(element =>
    element.querySelector('.el-dialog__title')?.textContent.trim() === '附加商品' &&
    element.textContent.includes('VIP001') && element.textContent.includes('1000')))
  const result = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll('.el-dialog')].find(element => element.querySelector('.el-dialog__title')?.textContent.trim() === '附加商品')
    if (!dialog) return null
    return { labels: [...dialog.querySelectorAll('.el-form-item__label')].map(element => element.textContent.trim()), width: dialog.style.getPropertyValue('--tf-dialog-explicit-width') }
  })
  assert.ok(result, '附加商品弹窗不存在')
  assert.equal(result.width, '', '附加商品采用公共默认宽度')
  for (const label of ['客户手机号', '客户姓名', '销售门店', '销售员', '销售日期', '支付方式', '支付渠道', '交易流水号', '数量', '单价', '商品名称', '赠品未退回约定单价（可空）']) assert.equal(result.labels.includes(label), false, `搭售重复展示${label}`)
  const tags = await page.$$eval('.checkout-dialog .el-tag, .form-section .tf-dialog-toolbar .el-tag', nodes => nodes.filter(node => node.checkVisibility()).map(node => ({ text: node.textContent, type: node.className })))
  assert.ok(tags.some(tag => tag.text.includes('会员号：VIP001') && tag.type.includes('primary')))
  assert.ok(tags.some(tag => tag.text.includes('姓名：样本客户') && tag.type.includes('success')))
  assert.ok(tags.some(tag => tag.text.includes('积分：1000') && tag.type.includes('warning')))
  assert.ok(tags.every(tag => !tag.text.includes('13900000001')))
}

export async function verifySalesPage(page, scenario, capture = async () => {}) {
  await page.waitForSelector('.sales-view .device-card, .sales-view .el-table__row')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '销售商品')), false, '销售页不提供独立商品开单')
  {
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
        await clickVisible(await button(page, '出库', '.record-detail-dialog'))
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
    assert.deepEqual(await page.evaluate(() => [...new Set(window.inventory.map(phone => phone.store_id))]), [1], '样本手机来源必须仍是一店')
    await selectItem(page, await sourceField(page, scope, scenario === 'batch' ? '销售店铺' : '销售门店'), '二店')
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
    await page.waitForFunction(() => document.body.textContent.includes('附加商品'))
    await checkInheritedSaleFields(page)
    assert.equal(await postCount(page, '/sales/checkout'), posts, '打开配件不能提前销售手机')
    assert.equal(await page.$eval(`${scope} textarea`, element => element.value), '原表单整批备注', '附加商品弹窗沿用外层备注')
    await clickButton(page, '取消')
    await page.waitForFunction(() => !document.body.textContent.includes('附加商品'))
    assert.equal(await page.$eval(`${scope} textarea`, element => element.value), '原表单整批备注', '取消配件不得清空原手机草稿')
    await clickButton(page, '配件')
  }
  await checkInheritedSaleFields(page)
  await select(page, '附加商品', '原装充电器')
  if (scenario === 'batch') await select(page, '关联手机', '手机甲')
  await clickButton(page, '确认')
  await select(page, '附加商品', '赠膜')
  await select(page, '出库方式', '赠送')
  if (scenario === 'batch') await select(page, '关联手机', '手机乙')
  await clickButton(page, '确认')
  await page.waitForFunction(() => document.querySelectorAll('.checkout-additional-goods .el-table__row').length === 2)
  const count = await page.evaluate(() => window.fixture.pageReads.filter(row => row.url === '/sales/phones/available').length)
  const goodsReads = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.reads)))
  assert.ok(goodsReads.length > 0, '必须实际检索商品候选')
  assert.ok(goodsReads.every(row => row.store_id === 2), '名称及SN候选必须读取销售二店，不能使用手机来源一店')
  await checkBoundaries(page)
  await capture()
  await clickButton(page, '确认添加')
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-dialog')].some(element => element.checkVisibility() && element.querySelector('.el-dialog__title')?.textContent.trim() === '附加商品'))
  assert.equal(await postCount(page, '/sales/checkout'), 0, '附加商品确认后原手机还未销售')
  assert.deepEqual(await page.evaluate(() => window.inventory.map(row => row.id)), [11,12])
  const scope = scenario === 'batch' ? '.sales-batch-sale-dialog' : '.sales-sale-dialog'
  assert.equal(await page.$eval(scope, element => element.checkVisibility()), true, '外层销售表单须继续显示')
  await page.evaluate(() => window.fixture.denied.push('accessories:create', 'query:goods-sell'))
  await clickButton(page, scenario === 'batch' ? '确认销售' : '确认出库')
  await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('权限已变更'))
  assert.equal(await postCount(page, '/sales/checkout'), 0, '确认后撤权不能提交，也不能回落手机单卖')
  await page.evaluate(() => { window.fixture.denied = [] })
  await clickButton(page, '配件')
  await page.waitForFunction(() => document.querySelectorAll('.checkout-additional-goods .el-table__row').length === 2)
  await clickButton(page, '取消')
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-dialog')].some(element => element.checkVisibility() && element.querySelector('.el-dialog__title')?.textContent.trim() === '附加商品'))
  await fillInput(page, await page.$(`${scope} textarea`), '外层最终备注')
  await clickButton(page, scenario === 'batch' ? '确认销售' : '确认出库')
  await page.waitForFunction(count => window.fixture.success.length === 1 && window.fixture.pageReads.filter(row => row.url === '/sales/phones/available').length > count, {}, count)
  await page.waitForFunction(() => [...document.querySelectorAll('.sales-sale-dialog, .sales-batch-sale-dialog')]
    .every(element => !element.checkVisibility()))
  const result = await page.evaluate(() => JSON.parse(JSON.stringify({
    posted: window.fixture.posts.filter(row => row.url === '/sales/checkout'),
    lastRead: window.fixture.pageReads.filter(row => row.url === '/sales/phones/available').at(-1),
    remaining: window.inventory.map(row => row.id)
  })))
  assert.equal(result.posted.length, 1)
  const data = result.posted[0].data
  assert.equal(data.store_id, 2, '共同结算必须沿用销售二店')
  assert.deepEqual(data.phones, scenario === 'batch' ? [{ phone_id:11,sale_price:100.01 },{ phone_id:12,sale_price:200.02 }] : [{ phone_id:11,sale_price:100.01 }])
  assert.deepEqual(data.accessories.map(row => row.linked_phone_id), scenario === 'batch' ? [11,12] : [11,11])
  assert.deepEqual(data.accessories.map(row => [row.accessory_id,row.quantity,row.sale_type,row.unit_price]), [[56,1,'sale',30],[57,1,'gift',0]])
  assert.deepEqual(data.customer_info, { name:'样本客户',phone:'13900000001' })
  assert.equal(data.remarks, '外层最终备注')
  assert.equal(result.lastRead.config.useCache, false, '成功后必须跳过旧库存缓存')
  assert.deepEqual(result.remaining, scenario === 'batch' ? [] : [12])
  await page.evaluate(() => window.fixture.denied.push('accessories:create', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'))
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(element => element.checkVisibility() && element.textContent.trim() === '销售商品'))
}

export async function verifyQuickSale(page, capture = async () => {}) {
  await page.waitForSelector('.quick-sale-dialog input')
  await capture('form')
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
  await checkInheritedSaleFields(page)
  assert.equal(await postCount(page, '/sales/checkout'), 0, '打开配件不能提前销售新手机')
  assert.equal(await page.$eval('.quick-sale-dialog textarea', element => element.value), '快速出库公共备注', '附加商品弹窗沿用外层备注')
  await clickButton(page, '取消')
  await page.waitForFunction(() => !document.body.textContent.includes('附加商品'))
  assert.equal(await (await field(page, '销售价格')).$eval('input', element => element.value), '100.02')
  assert.equal(await page.$eval('.quick-sale-dialog textarea', element => element.value), '快速出库公共备注')
  await input(page, '销售价格', '150.03')
  await clickButton(page, '配件')
  await checkInheritedSaleFields(page)
  await select(page, '附加商品', '原装充电器')
  await clickButton(page, '确认')
  await select(page, '附加商品', '赠膜')
  await select(page, '出库方式', '赠送')
  await clickButton(page, '确认')
  await checkBoundaries(page)
  await capture()
  await clickButton(page, '确认添加')
  await page.waitForFunction(() => ![...document.querySelectorAll('.el-dialog')].some(element => element.checkVisibility() && element.querySelector('.el-dialog__title')?.textContent.trim() === '附加商品'))
  assert.equal(await postCount(page, '/sales/checkout'), 0, '快速出库附加确认不得提前出库')
  assert.equal(await page.$eval('.quick-sale-dialog', element => element.checkVisibility()), true)
  await page.evaluate(() => window.fixture.denied.push('accessories:create', 'query:goods-sell'))
  await clickButton(page, '确认出库')
  await page.waitForFunction(() => window.fixture.notices.at(-1)?.message.includes('权限已变更'))
  assert.equal(await postCount(page, '/sales/checkout'), 0, '快速出库确认后撤权不能提交或回落旧接口')
  await page.evaluate(() => { window.fixture.denied = [] })
  await input(page, '销售价格', '160.04')
  await input(page, '备注', '快速出库最终备注')
  await clickButton(page, '确认出库')
  await page.waitForFunction(() => window.fixture.success.length === 1 && window.fixture.open === false)
  await page.waitForFunction(() => [...document.querySelectorAll('.quick-sale-dialog')].every(element => !element.checkVisibility()))
  const posts = await page.evaluate(() => JSON.parse(JSON.stringify(window.fixture.posts)))
  assert.deepEqual(posts.map(row => row.url), ['/sales/checkout'], '只能提交共同结算，不能另发旧手机出库')
  const data = posts[0].data
  assert.deepEqual(data.phones, [])
  assert.deepEqual(data.quick_phone, { brand_id:1,model_id:1,color_id:1,memory_id:1,supplier_id:1,is_new:1,
    imei:'012345678901234',serial_number:'QUICK0001',purchase_cost:80.01,sale_price:160.04,
    inventory_time:data.quick_phone.inventory_time })
  assert.match(data.quick_phone.inventory_time, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(data.store_id, 1); assert.equal(data.operator_id, 7)
  assert.deepEqual(data.customer_info, { name:'样本客户',phone:'13900000001' })
  assert.equal(data.remarks, '快速出库最终备注')
  assert.deepEqual(data.accessories.map(row => [row.accessory_id,row.quantity,row.sale_type,row.unit_price,row.linked_phone_id]),
    [[56,1,'sale',30,1],[57,1,'gift',0,1]])
  assert.equal(data.payment_info.payment_amount, 190.04)
}
