import assert from 'node:assert/strict'
import { salesEnvironment, clickVisible, clickButton, checkBoundaries } from './sales-checkout-browser-fixture.mjs'

// 真实核对弹窗及公共样式；只读服务为内存响应，所有业务网络由宿主阻断。
export const purchaseReturnEntry = `${salesEnvironment}
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import RecordDetailDialog from '/src/components/RecordDetailDialog.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import Pagination from '/src/components/Pagination.vue';
import {vTFLoading} from '/src/directives/index.ts';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
const {default:Panel}=await import('/src/views/payments/page/AccessoryPurchaseReturnContext.vue');
window.purchasePaid=true;
window.mockRead=async(url,config)=>{
  if(url!=='/supplier-payments/accessory-purchases/8/return-context')throw Error('未登记的原采购读取');
  window.fixture.reads.push({url,useCache:config.useCache});
  return {success:true,data:{purchase:{id:8,has_snapshot:true,name:'原采购通用充电器',batch_no:'IN-ORIGINAL-8',supplier_id:3,
    supplier_name:'原供应商',store_id:1,store_name:'原一店',quantity:50,purchase_cost:'12.50',total_amount:'625.00',
    paid_amount:window.purchasePaid?625:0,unpaid_amount:window.purchasePaid?0:625,payment_status:window.purchasePaid?'paid':'unpaid'},
    ledger_status:'verified',current_quantity:6,
    data:[{row_key:'event:1',store_id:2,store_name:'当前二店',quantity:5,purchase_cost:'12.50',usage_type:'sale',serial_tracking:0},
      {row_key:'event:2',store_id:2,store_name:'当前二店',quantity:1,purchase_cost:'12.50',usage_type:'sale',serial_tracking:1}],
    pagination:{page:1,page_size:20,total:2},serials:{data:[{id:91,serial_number:'000ABC',store_id:2,store_name:'当前二店'}],
      pagination:{page:1,page_size:20,total:1}}}};
};
window.mockPost=async(url,data)=>{
  if(url!=='/supplier-payments/accessory-purchases/8/return/quote')throw Error('退供核对不得提交写入');
  window.fixture.posts.push({url,data:structuredClone(data)});
  const quantity=data.batches.reduce((sum,row)=>sum+row.quantity,0)+data.serial_ids.length;
  const total=quantity*12.5,mode=data.settlement_mode;
  const response={success:true,data:{purchase_id:8,quantity,purchase_cost:12.5,total_amount:total,payment_status:window.purchasePaid?'paid':'unpaid',
    latest_event_id:window.purchasePaid?1:0,preview_only:true,
    settlement:{mode,payable_reduction:mode==='reduce_payable'?total:0,refund_amount:mode==='supplier_refund'?total:0,credit_amount:mode==='supplier_credit'?total:0},
    data:[...data.batches.map(row=>({...row,store_id:2,store_name:'当前二店',usage_type:'sale',serial_tracking:0,serial_numbers:[]})),
      ...(data.serial_ids.length?[{row_key:'event:2',store_id:2,store_name:'当前二店',quantity:1,usage_type:'sale',serial_tracking:1,serial_numbers:['000ABC']}]:[])]}};
  if(window.fixture.holdNext){window.fixture.holdNext=false;await new Promise(done=>window.releaseQuote=()=>done())}
  if(window.fixture.failNext){window.fixture.failNext=false;throw Error('隔离试算失败')}
  return response;
};
const open=ref(true);
const app=createApp({render:()=>h(Panel,{visible:open.value,purchaseId:8,'onUpdate:visible':value=>{open.value=value;window.fixture.open=value}})});
app.use(createPinia());app.use(ElementPlus);
for(const [name,component] of Object.entries({MobileDialog,SectionLoading,RecordDescriptions,RecordDetailDialog,DataEmptyState,Pagination}))app.component(name,component);
app.directive('permission',{});app.directive('tf-loading',vTFLoading);app.directive('table-double-tap',vTableDoubleTap);app.mount('#app');
`

async function quantity(page, value) {
  const control = await page.$('input[aria-label="当前二店待退数量"]')
  await clickVisible(control)
  await control.evaluate(element => element.select())
  await page.keyboard.press('Backspace')
  assert.equal(await control.evaluate(element => element.value), '', '键盘清空数量后须保持空白')
  await control.type(String(value))
  await page.keyboard.press('Tab')
  assert.equal(await control.evaluate(element => element.value), String(value), '清空后重新输入须保留实际数量')
}
async function radio(page, text) {
  for (const label of await page.$$('.el-radio')) if (await label.evaluate((element, text) => element.textContent.trim() === text, text)) return clickVisible(label)
  assert.fail(`缺少资金方式 ${text}`)
}
async function waitAmount(page, label, amount) {
  await page.waitForFunction((label, amount) => [...document.querySelectorAll('.el-descriptions')].some(description => {
    const labels = [...description.querySelectorAll('.el-descriptions__label')]
    const values = [...description.querySelectorAll('.el-descriptions__content')]
    return values[labels.findIndex(element => element.textContent.trim() === label)]?.textContent.trim() === amount
  }), {}, label, amount).catch(async error => {
    const state = await page.evaluate(() => ({
      text: document.body.textContent.slice(-3000), posts: JSON.parse(JSON.stringify(window.fixture.posts)),
      descriptions: [...document.querySelectorAll('.el-descriptions')].map(element => ({
        labels: [...element.querySelectorAll('.el-descriptions__label')].map(cell => cell.textContent.trim()),
        values: [...element.querySelectorAll('.el-descriptions__content')].map(cell => cell.textContent.trim())
      }))
    }))
    throw new Error(`未显示${label} ${amount}：${JSON.stringify(state)}`, { cause: error })
  })
}
export async function verifyPurchaseReturn(page, capture = async () => {}) {
  await page.waitForSelector('input[aria-label="当前二店待退数量"]')
  await quantity(page, 2)
  assert.equal((await page.$$('.el-checkbox')).length, 1, '本页样本只有一件可退SN')
  await clickVisible(await page.$('.el-checkbox'))
  await clickButton(page, '按原采购价试算')
  await waitAmount(page, '拟收供应商退款', '¥37.5')
  await checkBoundaries(page)
  await capture()
  await radio(page, '留抵后续货款')
  await page.waitForFunction(() => !document.body.textContent.includes('拟收供应商退款'))
  await clickButton(page, '按原采购价试算')
  await waitAmount(page, '拟留抵后续货款', '¥37.5')
  await page.evaluate(() => { window.fixture.holdNext = true })
  await clickButton(page, '按原采购价试算')
  await page.waitForFunction(() => typeof window.releaseQuote === 'function')
  await radio(page, '供应商退款')
  await page.evaluate(() => window.releaseQuote())
  await page.waitForFunction(() => !document.body.textContent.includes('拟留抵后续货款'))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('拟留抵后续货款')), false, '迟到旧资金方式试算不恢复')
  await page.evaluate(() => { window.fixture.failNext = true })
  await clickButton(page, '按原采购价试算')
  await page.waitForFunction(() => document.body.textContent.includes('退供试算失败'))
  await clickButton(page, '重试试算')
  await waitAmount(page, '拟收供应商退款', '¥37.5')
  await page.evaluate(() => { window.purchasePaid = false })
  await clickButton(page, '重新核对')
  await page.waitForFunction(() => document.body.textContent.includes('未付款采购退供按原采购价试算'))
  assert.equal(await page.$('.el-radio-group'), null, '未付款不出现退款和留抵选项')
  await quantity(page, 1)
  await clickButton(page, '按原采购价试算')
  await waitAmount(page, '拟冲减应付', '¥12.5')
  await checkBoundaries(page)
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(element => /提交|确认退供/.test(element.textContent))), false)
  const modes = await page.evaluate(() => window.fixture.posts.map(row => row.data.settlement_mode))
  assert.ok(modes.includes('supplier_refund') && modes.includes('supplier_credit') && modes.includes('reduce_payable'))
  await page.evaluate(() => window.fixture.denied.push('supplier-payments:view'))
  await page.waitForFunction(() => !window.fixture.open && !document.body.textContent.includes('原采购通用充电器'))
}
