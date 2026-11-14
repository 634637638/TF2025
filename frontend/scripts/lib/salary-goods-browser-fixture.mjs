// 真实工资弹窗及公共响应式组件；仅内存样本，不调用业务接口或发放工资。
export const salaryGoodsEntry = `
import { createApp, h, ref, nextTick } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import Edit from '/src/views/salary/page/SalaryEditPayoutDialog.vue';
import Settle from '/src/views/salary/page/SalarySettleDialog.vue';
import Detail from '/src/views/salary/page/SalaryDetailDialog.vue';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import AmountInput from '/src/components/AmountInput.vue';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/responsive.scss';
const mode=ref('edit'),open=ref(false),hidden=ref(false),saving=ref(false);
const summary={earned_amount:10,reversal_amount:3.34,net_amount:6.66,entries:[
  {kind:'return',order_id:81,order_item_id:82,aftersale_id:91,aftersale_item_id:92,original_salary_record_id:71,
    quantity:1,business_time:'2026-11-12 10:00:00',recorded_at:'2026-11-12 10:01:00',amount:-3.34}]};
const edit=ref({id:16,employee_id:7,salary_template_id:4,base_salary:2000,commission_amount:100,overtime_pay:0,
  leave_deduction:0,status:'approved'});
const form=ref({recordId:16,employeeId:7,employeeName:'工资员工长名称',netSalary:2106.66,payment_method:'cash'});
const record={employee_id:7,employee_name:'工资员工长名称',period_start:'2026-11-01',base_salary:2000,
  commission_amount:106.66,net_salary:2106.66,goods_commission:summary,sales_count:0,overtime_hours:0,overtime_pay:0,
  actual_work_days:30,leave_days:0,leave_deduction:0,status:'paid'};
const visible=(_module,field)=>!hidden.value||field!=='commission_amount';
const app=createApp({render:()=>h(mode.value==='edit'?Edit:mode.value==='settle'?Settle:Detail,{
  key:mode.value,modelValue:open.value,'onUpdate:modelValue':v=>open.value=v,saving:saving.value,
  canViewField:visible,canEditField:()=>true,employeeName:'工资员工长名称',goodsCommission:summary,
  form:mode.value==='edit'?edit.value:form.value,'onUpdate:form':v=>mode.value==='edit'?edit.value=v:form.value=v,
  netSalary:'2106.66',record,formatLeaveDays:v=>v??'-',formatWorkDays:v=>v??'-',formatMonth:v=>v,getEmployeeName:()=>record.employee_name,
  onClose:()=>open.value=false,onSubmit:()=>{throw new Error('视觉夹具禁止业务提交')}
})});
app.use(createPinia());app.use(ElementPlus);app.component('RecordDescriptions',RecordDescriptions);app.component('AmountInput',AmountInput);app.mount('#app');
const wait=()=>new Promise(resolve=>setTimeout(resolve,350));
const check=(ok,message)=>{if(!ok)throw new Error(message)};
window.runInputSmoke=async()=>{
 const results=[];
 for(const theme of ['light','dark']){
  document.documentElement.dataset.theme=theme;
  for(const kind of ['edit','settle','detail']){
   open.value=false;await wait();mode.value=kind;hidden.value=false;saving.value=false;await nextTick();open.value=true;await wait();
   const dialog=[...document.querySelectorAll('[role=dialog]')].find(node=>node.getBoundingClientRect().width>0);
   check(dialog,'弹窗未显示 '+kind);
   const bounds=dialog.getBoundingClientRect();check(bounds.left>=-1&&bounds.right<=innerWidth+1,'弹窗超出视口 '+kind);
   const body=dialog.querySelector('.mobile-dialog-sheet-body,.el-dialog__body');
   check(body&&body.scrollWidth<=body.clientWidth+1,'正文横向溢出 '+kind);
   const text=dialog.textContent+[...dialog.querySelectorAll('input')].map(node=>node.value).join(' ');
   check(text.includes('商品退货扣回')&&text.includes('2106.66'),'摘要或总额缺失 '+kind);
   const toggle=dialog.querySelector('.el-collapse-item__header');check(toggle,'来源展开入口缺失');toggle.click();await wait();
   check(dialog.textContent.includes('81 / 明细 82')&&dialog.textContent.includes('原工资'),'原单关联缺失');
   check(body.scrollWidth<=body.clientWidth+1,'展开来源后溢出 '+kind);
   hidden.value=true;await nextTick();check(!dialog.textContent.includes('商品退货扣回'),'隐藏提成仍泄漏摘要 '+kind);
   if(kind==='edit'){
    saving.value=true;await nextTick();
    const inputs=[...dialog.querySelectorAll('input')].filter(node=>!node.readOnly);
    check(inputs.every(node=>node.disabled),'保存中仍可编辑');
    check(!dialog.textContent.includes('已结算'),'编辑仍可直接发放');
   }
   open.value=false;await wait();results.push({theme,kind,width:innerWidth});
  }
 }
 return {ok:true,results,userAgent:navigator.userAgent};
};
window.fixtureReady=true;
if(location.search.includes('autorun'))window.runInputSmoke().then(result=>fetch('/__input-result',{method:'POST',body:JSON.stringify(result)})).catch(error=>fetch('/__input-result',{method:'POST',body:JSON.stringify({ok:false,error:error.message})}));
`
