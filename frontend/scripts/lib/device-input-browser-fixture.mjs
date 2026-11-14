// 国补真实编辑组件和公共弹窗；接口、通知与资料选项由隔离宿主提供内存替身。
export const deviceInputEntry = `
import {createApp,h,reactive,nextTick} from 'vue';
import {createPinia} from 'pinia';
import {ElButton,ElDialog,ElInput,ElForm,ElFormItem,ElSelect,ElOption,ElDatePicker,ElDescriptionsItem,ElDivider,ElSwitch} from 'element-plus';
import SubsidyEditDialog from '/src/views/subsidy/components/SubsidyEditDialog.vue';
import AmountInput from '/src/components/AmountInput.vue';
import RecordDescriptions from '/src/components/RecordDescriptions.vue';
import {normalizeSafariPhoneViewportMeta,applyDeviceRootClass} from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';
import '/src/styles/components/_dialog-actions.scss';
normalizeSafariPhoneViewportMeta();applyDeviceRootClass();
window.fixtureCalls=[];window.fixtureNotices=[];
const state=reactive({open:false,remarksOnly:false,item:{id:9,serial_number:'00AB/CD-1234',imei1:'012345678901234',customer_phone:'13800138000',remarks:'原备注'}});
const allowed=field=>state.remarksOnly?field==='remarks':['serial_number','imei1','customer_phone','remarks'].includes(field);
const app=createApp({render:()=>h(SubsidyEditDialog,{modelValue:state.open,'onUpdate:modelValue':value=>state.open=value,item:state.item,stores:[],canViewField:allowed,canEditField:allowed,canApprove:false,canArrival:false})});
app.use(createPinia());
for(const component of [ElButton,ElDialog,ElInput,ElForm,ElFormItem,ElSelect,ElOption,ElDatePicker,ElDescriptionsItem,ElDivider,ElSwitch])app.component(component.name,component);
app.component('RecordDescriptions',RecordDescriptions);app.component('AmountInput',AmountInput);app.mount('#app');
const wait=()=>new Promise(resolve=>setTimeout(resolve,180));
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const panel=()=>[...document.querySelectorAll('.el-dialog')].find(element=>element.getClientRects().length);
const input=label=>[...panel().querySelectorAll('input,textarea')].find(element=>element.placeholder===label);
const fill=async(label,value,composing=false)=>{const element=input(label);check(Boolean(element),'缺少字段 '+label);if(composing)element.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));if(composing){element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:value}));element.dispatchEvent(new Event('input',{bubbles:true}))}await nextTick();return element};
const save=async()=>{[...panel().querySelectorAll('button')].find(button=>button.textContent.trim()==='保存').click();await wait()};
const layout=()=>{const element=panel();const rect=element.getBoundingClientRect();check(rect.left>=-1&&rect.right<=innerWidth+1,'弹窗横向溢出');check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'页面横向溢出');const footer=element.querySelector('.el-dialog__footer');footer?.scrollIntoView({block:'nearest'});check(Boolean(footer),'底部按钮不存在')};
window.runInputSmoke=async()=>{
  const results=[];
  for(const theme of ['light','dark']){
    document.documentElement.dataset.theme=theme;state.remarksOnly=false;state.open=true;await wait();
    const serial=await fill('请输入序列号','AB中1234',true);
    const imei=await fill('请输入IMEI1','0123456789012345');
    check(serial.value==='AB中1234','组合输入被删字后变成另一编码');
    check(imei.value==='0123456789012345','超长 IMEI 被截短');
    await save();check(window.fixtureCalls.length===0&&state.open,'非法序列号仍保存或关闭');
    check(window.fixtureNotices.some(notice=>notice.kind==='warning'),'非法内容没有提示');
    await fill('请输入序列号','00ab/cd-1234');await save();
    check(window.fixtureCalls.length===0&&state.open,'超长 IMEI 仍保存');
    await fill('请输入IMEI1','012345678901234');
    const phone=await fill('请输入客户手机号','138001380001');
    check(!phone.hasAttribute('maxlength')&&phone.value==='138001380001','手机号被原生控件截短');await save();
    check(window.fixtureCalls.length===0&&state.open,'超长手机号仍保存');
    await fill('请输入客户手机号','+86 138-0013-8000');layout();await save();
    check(window.fixtureCalls.length===1&&!state.open,'合法编码没有保存关闭');
    const payload=window.fixtureCalls[0].value;
    check(payload.serial_number==='00AB/CD-1234'&&payload.imei1==='012345678901234'&&payload.customer_phone==='13800138000','合法前导零、分隔符或手机号标准化失败');
    state.remarksOnly=true;state.item={id:9,serial_number:'旧编码含中文',imei1:'legacy',remarks:'只改备注'};state.open=true;await wait();layout();await save();
    check(window.fixtureCalls.length===2&&!state.open,'隐藏旧字段阻止备注保存');
    check(JSON.stringify(window.fixtureCalls[1].value)===JSON.stringify({remarks:'只改备注'}),'隐藏字段被提交');
    window.fixtureCalls=[];window.fixtureNotices=[];
    results.push({theme,width:innerWidth,checks:'真实国补编辑：组合输入、超长拒绝、非法不请求、前导零、SN分隔符、隐藏字段及窄屏按钮'});
  }
  return {ok:true,results,userAgent:navigator.userAgent};
};
window.fixtureReady=true;
if(location.search.includes('autorun'))window.runInputSmoke().then(result=>fetch('/__input-result',{method:'POST',body:JSON.stringify(result)})).catch(error=>fetch('/__input-result',{method:'POST',body:JSON.stringify({ok:false,error:error.message+'\\n'+error.stack})}));
`
