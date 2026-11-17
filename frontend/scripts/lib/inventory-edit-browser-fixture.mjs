// 真实库存编辑组件及路由页样式；只维护内存表单，不访问业务接口。
export const inventoryEditEntry = `
import {createApp,h,reactive,nextTick} from 'vue';
import {createPinia} from 'pinia';
import ElementPlus from 'element-plus';
import AmountInput from '/src/components/AmountInput.vue';
import {vIdentifierInput} from '/src/directives/identifier-input.ts';
import {applyDeviceRootClass} from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/admin-layout.css';import '/src/styles/responsive.scss';
import '/src/views/permissions/styles/permissions-view.css';
import '/src/styles/components/_dialog.scss';import '/src/styles/components/_dialog-actions.scss';
// 保留路由页样式后加载的实际顺序，检测私有列声明对公共手机网格的影响。
await import('/src/views/inventory/InventoryView.vue?vue&type=style&index=0&lang.css');
const {default:InventoryEditDialog}=await import('/src/views/inventory/page/InventoryEditDialog.vue');
const {default:RoleFieldPermissionDialog}=await import('/src/views/permissions/page/RoleFieldPermissionDialog.vue');
const {getModuleFieldGroups}=await import('/src/config/moduleFields.js');
applyDeviceRootClass();
const state=reactive({open:true,hidden:[],readonly:false,mode:'inventory',fieldHidden:[],fieldReadonly:['basic.imei']});
const form=reactive({brand_id:1,brand:'样本品牌',color_id:1,color:'黑色',condition:'全新',imageHover:false,
 imei:'012345678901234',inventory_time:'2026-11-16',memory_id:1,memory:'256G',model_id:1,model:'样本长型号名称',
 purchase_cost:1000,remarks:'长备注'.repeat(60),serial_number:'00ABCD123456789012',status:'in_stock',store_id:1,supplier_id:1});
const allowed=field=>!state.hidden.includes(field);
const app=createApp({render:()=>state.mode==='permissions'?h(RoleFieldPermissionDialog,{
 modelValue:true,roleName:'库存标杆',selectedModule:{key:'inventory_inventoryview',name:'库存管理',icon:'inventory'},
 modules:[],fieldGroups:getModuleFieldGroups('inventory_inventoryview'),selectedFieldGroupName:'基本信息',selectedFields:state.fieldHidden,
 readonlyFields:state.fieldReadonly,configReady:true,saving:false,loadingModules:false,loadingGroups:false,
 getFieldTypeLabel:value=>value,getSensitivityLabel:value=>value,isFieldSensitive:()=>false,
 'onUpdate:selectedFields':value=>state.fieldHidden=value,'onUpdate:readonlyFields':value=>state.fieldReadonly=value
}):h(InventoryEditDialog,{modelValue:state.open,'onUpdate:modelValue':value=>state.open=value,
 editForm:form,canViewField:allowed,canEditField:()=>!state.readonly,brands:[{id:1,name:'样本品牌'}],brandModels:['样本长型号名称'],
 colors:['黑色'],memories:['256G'],stores:[{id:1,name:'测试门店长名称'}],suppliers:[{id:1,name:'测试供应商长名称'}],
 phoneStatusOptions:[{value:'in_stock',label:'在库'}],modelSearchLoading:false,noImeiMode:false,submitting:false,
 remoteSearchModel:()=>{},onClose:()=>state.open=false,onSubmit:()=>{throw Error('布局回归禁止业务提交')}
})});
app.component('IconRenderer',{render:()=>null});app.use(createPinia());app.use(ElementPlus);app.component('AmountInput',AmountInput);app.directive('identifier-input',vIdentifierInput);app.mount('#app');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const settle=async()=>{await nextTick();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))};
const fields=['supplier_name','store_name','inventory_time','is_new','brand','model','color','memory','serial_number','imei','purchase_cost','remarks'];
const inspect=profile=>{
 const grid=document.querySelector('.inventory-edit-form-grid'),columns=getComputedStyle(grid).gridTemplateColumns.split(' ');
 const mobile=innerWidth<=767,expectedColumns=mobile?2:3;
 check(columns.length===expectedColumns,profile+'：实际列数错误 '+JSON.stringify(columns));
 const body=grid.closest('.el-dialog__body'),bounds=grid.getBoundingClientRect();
 check(body.scrollWidth<=body.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,profile+'：编辑弹窗横向溢出');
 const short=[...grid.querySelectorAll(':scope > .form-group:not(.tf-form-field--wide)')];
 if(profile==='full'&&mobile){
  const first=short[0].getBoundingClientRect(),second=short[1].getBoundingClientRect();
  check(Math.abs(first.top-second.top)<1&&Math.abs(first.width-second.width)<1&&second.left>first.right,'手机短字段未按两列等宽排列');
  const serial=document.querySelector('.inventory-edit-serial-field').getBoundingClientRect(),imei=document.querySelector('.inventory-edit-imei-field').getBoundingClientRect();
  check(Math.abs(serial.top-imei.top)<1&&Math.abs(serial.width-imei.width)<1&&imei.left>serial.right,'序列号和IMEI没有同行两列');
  const summary=document.querySelector('.inventory-edit-summary-grid'),serialCard=summary.querySelector('.bg-gradient-serial').getBoundingClientRect(),priceCard=summary.querySelector('.bg-gradient-purchase').getBoundingClientRect();
  check(Math.abs(serialCard.top-priceCard.top)<1&&Math.abs(serialCard.width-priceCard.width)<1&&priceCard.left>serialCard.right,'顶部序列号与入库价格卡片未同行等宽展示');
  check(summary.scrollWidth<=summary.clientWidth+1,'长序列号撑出顶部摘要卡片');
 }
 if(mobile&&allowed('purchase_cost')&&allowed('status')){
  const status=grid.querySelector('.inventory-edit-status-field').getBoundingClientRect(),price=grid.querySelector('.inventory-edit-price-field').getBoundingClientRect();
  check(Math.abs(status.top-price.top)<1&&Math.abs(status.width-price.width)<1&&price.left>status.right,'状态与入库价格未同行等宽排列：'+profile);
 }
 if(profile==='only-status'&&mobile)check(Math.abs(short[0].getBoundingClientRect().width-bounds.width)<1,'权限隐藏后唯一字段未铺满');
 for(const field of grid.querySelectorAll('.form-group,.inventory-edit-serial-field,.inventory-edit-imei-field')){
  const rect=field.getBoundingClientRect();check(rect.left>=bounds.left-1&&rect.right<=bounds.right+1,'字段超出网格边界');
 }
 const remarks=grid.querySelector('.tf-form-field--wide');
 if(remarks)check(Math.abs(remarks.getBoundingClientRect().width-bounds.width)<1,'备注没有整行展示');
 if(state.readonly)for(const field of grid.querySelectorAll('.form-group,.inventory-edit-serial-field,.inventory-edit-imei-field')){
  check([...field.querySelectorAll('input,textarea')].every(input=>input.disabled),'只读字段被布局改为可编辑');
 }
 check(form.imei==='012345678901234'&&form.serial_number==='00ABCD123456789012','布局修改改变设备编码');
};
window.runInputSmoke=async()=>{
 const results=[];
 for(const theme of ['light','dark']){
  document.documentElement.dataset.theme=theme;state.mode='inventory';state.hidden=[];state.readonly=false;await settle();inspect('full');
  state.hidden=['remarks'];await settle();inspect('without-remarks');
  state.hidden=['status'];await settle();inspect('without-status');check(!document.querySelector('.inventory-edit-status-field'),'状态隐藏失效');
  state.hidden=['supplier_name','serial_number','imei','remarks'];await settle();inspect('odd-fields');
  state.hidden=['supplier_name','serial_number','remarks'];state.readonly=true;await settle();inspect('partial');
  state.hidden=fields;await settle();inspect('only-status');
  state.hidden=[...fields,'status'];await settle();check(!document.querySelector('.inventory-edit-form-grid .form-group'),'所有字段隐藏后仍有编辑项');
  state.mode='permissions';await settle();
  check(document.querySelectorAll('.field-switch-action .el-radio-group').length>0,'库存三态字段控件未显示');
  check(document.documentElement.scrollWidth<=innerWidth+1,'三态权限弹窗横向溢出');
  const stateSelector=document.querySelector('.field-switch-action .tf-state-selector');
  check(stateSelector&&getComputedStyle(stateSelector).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(stateSelector).boxShadow==='none','状态选项组不应显示外层背景');
  check(!stateSelector.querySelector('.el-icon'),'状态选项仅显示文字');
  const selectedState=stateSelector.querySelector('.el-radio-button__original-radio:checked + .el-radio-button__inner');
  const tabColorProbe=document.createElement('span');
  tabColorProbe.style.backgroundColor='var(--tf-tab-active-bg)';document.body.append(tabColorProbe);
  const expectedActiveColor=getComputedStyle(tabColorProbe).backgroundColor;tabColorProbe.remove();
  check(selectedState&&getComputedStyle(selectedState).backgroundColor===expectedActiveColor,'状态选中颜色未跟随全局TAB主色');
  for(const control of document.querySelectorAll('.field-switch-action .el-radio-group')){
   const rect=control.getBoundingClientRect();check(rect.left>=0&&rect.right<=innerWidth+1,'三态控件超出手机边界');
   check(new Set([...control.querySelectorAll('.el-radio-button')].map(item=>Math.round(item.getBoundingClientRect().top))).size===1,'三态控件换行');
  }
  const imei=[...document.querySelectorAll('.field-switch-item')].find(item=>item.textContent.includes('IMEI码'));
  check(imei?.querySelector('.el-radio-button.is-active')?.textContent.includes('只读'),'只读状态未恢复');
  const triStateTitles=[...document.querySelectorAll('.field-switch-item--tri-state .field-switch-title strong')];
  check(triStateTitles.length>0,'库存三态字段标题未渲染');
  for(const title of triStateTitles){
   const bounds=title.getBoundingClientRect();
   check(bounds.width>40,'字段标题可用宽度不足');
   check(bounds.height<=parseFloat(getComputedStyle(title).lineHeight)*1.2,'字段标题在手机端意外逐字换行');
  }
  results.push({theme,width:innerWidth,checks:'库存编辑及字段三态：手机两列、状态隐藏/只读、SN/IMEI同行、三态控件和长内容边界'});
 }
 state.mode='inventory';state.hidden=[];state.readonly=false;await settle();
 return {ok:true,results,userAgent:navigator.userAgent};
};
window.fixtureReady=true;
if(location.search.includes('autorun'))window.runInputSmoke().then(result=>fetch('/__input-result',{method:'POST',body:JSON.stringify(result)})).catch(error=>fetch('/__input-result',{method:'POST',body:JSON.stringify({ok:false,error:error.message})}));
`
