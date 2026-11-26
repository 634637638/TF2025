// 正式公共交互回归：真实组件、真实页面片段，仅在隔离宿主中保存内存状态。
export const overlayEntry = `
import {createApp,h,reactive,nextTick,withDirectives} from 'vue';
import {createPinia} from 'pinia';
import {ElButton,ElDialog,ElInput,ElIcon,ElForm,ElFormItem,ElTag,ElTable,ElTableColumn} from 'element-plus';
import {WarningFilled,Grid,Box,Download} from '@element-plus/icons-vue';
import MobileDialog from '/src/components/MobileDialog.vue';
import MediaPreviewViewer from '/src/components/MediaPreviewViewer.vue';
import CustomerNameLockInput from '/src/components/common/CustomerNameLockInput.vue';
import PublicPriceHeader from '/src/components/base/PublicPriceHeader.vue';
import PublicSearchBox from '/src/components/search/PublicSearchBox.vue';
import {useCustomerNamePrompt} from '/src/composables/useCustomerNamePrompt.ts';
import {useNotification} from '/src/composables/useNotification.ts';
import WholesaleHeader from '/__quote-header-wholesale.js';
import SalesHeader from '/__quote-header-sales.js';
import WholesaleSave from '/__quote-save-wholesale.js';
import SalesSave from '/__quote-save-sales.js';
import RoleFormDialog from '/src/views/permissions/page/RoleFormDialog.vue';
import StoreBindingDialog from '/src/views/permissions/page/StoreBindingDialog.vue';
import {vTFLoading} from '/src/directives/index.ts';
import {normalizeSafariPhoneViewportMeta,applyDeviceRootClass} from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';
import '/src/styles/components/_dialog-actions.scss';
import '/src/views/price-list/page/PublicPriceQuery.global.scss';
import '/src/views/price-list/page/PublicPriceQuery.vue?vue&type=style&index=2&lang.scss';
import '/src/views/price-list/page/SalesPriceDisplay.vue?vue&type=style&index=2&lang.scss';
// 页面按路由懒加载，兜底组件样式在全局样式后注入；保留真实的级联顺序。
const {default:TableLoadingRow}=await import('/src/components/TableLoadingRow.vue');
const {default:SectionLoading}=await import('/src/components/SectionLoading.vue');
const {default:LoadingOverlay}=await import('/src/components/LoadingOverlay.vue');
normalizeSafariPhoneViewportMeta();applyDeviceRootClass();
const faults=[];
window.addEventListener('error',event=>{if(event.error)faults.push(event.message)});
window.addEventListener('unhandledrejection',event=>faults.push(String(event.reason)));
const state=reactive({view:'dialog',base:false,child:false,media:false,name:'测试姓名',saved:[],failSave:false,index:0,actions:false,saving:false,submits:0,selectedStores:[],tableLoading:false,loadingText:'正在刷新设备查询结果...',narrowRegion:false,sectionSize:'normal',rows:[]});
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#426fa3"/></svg>');
const items=Array.from({length:30},(_,index)=>({url:image+'#'+index,type:'image',label:'很长的测试素材文件名重复内容'+index}));
let promptName,confirmDelete,prompting;
const app=createApp({setup(){
  const {promptCustomerName,promptingCustomerName}=useCustomerNamePrompt();prompting=promptingCustomerName;
  const {confirm}=useNotification();
  promptName=()=>promptCustomerName(state.name,async name=>{await new Promise(resolve=>setTimeout(resolve,40));if(state.failSave)throw new Error('模拟保存失败');state.name=name;state.saved.push(name)});
  confirmDelete=()=>confirm('测试删除确认','确认');
  return ()=>h('main',[
    state.view==='table'?withDirectives(h(ElTable,{data:state.rows,class:'fixture-table'}, {default:()=>h(ElTableColumn,{prop:'name',label:'设备'}),empty:()=>state.tableLoading?h(TableLoadingRow,{mode:'block',text:'正在读取设备查询结果...'}):h('div','暂无数据')}),[[vTFLoading,{active:state.tableLoading,text:state.loadingText}]]):null,
    state.view==='loading-region'?withDirectives(h('div',{class:'fixture-loading-region',style:{height:'240px',width:state.narrowRegion?'min(100%, 200px)':'100%'}},'已有客户贴膜记录'),[[vTFLoading,{active:state.tableLoading,text:state.loadingText}]]):null,
    state.view==='section-loading'?h(ElForm,{class:'tf-dialog-form fixture-loading-form',labelPosition:'top',style:{width:state.narrowRegion?'min(100%, 200px)':'100%'}},()=>h(ElFormItem,{label:'选择商品'},()=>h(SectionLoading,{text:state.loadingText,size:state.sectionSize}))):null,
    state.view==='loading-overlay'?h(LoadingOverlay,{class:'fixture-loading-overlay',loading:true,text:state.loadingText,style:{height:'240px',width:state.narrowRegion?'min(100%, 200px)':'100%'}},()=>h('p','已有商品数据')):null,
    state.view==='dialog'?h(MobileDialog,{modelValue:state.base,'onUpdate:modelValue':value=>state.base=value,title:'公共明细测试',dialogClass:'fixture-base',width:'800px'},()=>[h(ElForm,{class:'tf-dialog-form'},()=>h(ElFormItem,{label:'表单标签'},()=>h(ElInput,{modelValue:'测试内容'}))),...Array.from({length:30},(_,i)=>h('p','长内容 '+i))]):null,
    state.view==='dialog'?h(MobileDialog,{modelValue:state.child,'onUpdate:modelValue':value=>state.child=value,title:'嵌套测试',dialogClass:'fixture-child'},()=>h('p','上层内容')):null,
    state.view==='name'?h(CustomerNameLockInput,{modelValue:state.name,selected:true,onUnlock:promptName}):null,
    state.view==='role'?h(RoleFormDialog,{modelValue:state.base,'onUpdate:modelValue':value=>state.base=value,name:'测试角色',code:'test_role',description:'内存测试角色',isEdit:false,saving:state.saving,onSubmit:()=>state.submits++}):null,
    state.view==='stores'?h(StoreBindingDialog,{modelValue:state.base,'onUpdate:modelValue':value=>state.base=value,selectedStoreIds:state.selectedStores,stores:[{id:1,name:'测试门店'}],user:null,saving:state.saving,onSave:()=>state.submits++,onClose:()=>state.base=false}):null,
    state.view==='header-wholesale'?h(WholesaleHeader):state.view==='header-sales'?h(SalesHeader):null,
    state.view==='save-wholesale'?h(WholesaleSave):state.view==='save-sales'?h(SalesSave):null,
    h(MediaPreviewViewer,{modelValue:state.media,'onUpdate:modelValue':value=>state.media=value,items,initialIndex:state.index,deletable:state.actions,downloadable:state.actions,onDelete:confirmDelete})
  ]);
}});
app.use(createPinia());
for(const [name,component] of Object.entries({MobileDialog,ElButton,ElDialog,ElInput,ElIcon,ElTag,PublicPriceHeader,PublicSearchBox,WarningFilled,Grid,Box,Download}))app.component(name,component);
app.mount('#app');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const visible=element=>Boolean(element&&element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden');
const all=selector=>[...document.querySelectorAll(selector)].filter(visible);
const one=selector=>all(selector).at(-1);
const settle=async()=>{await nextTick();await pause(380)};
const until=async(fn,message)=>{for(let i=0;i<80;i++){if(fn())return;await pause(50)}throw new Error(message+' '+JSON.stringify({boxes:all('.el-message-box').map(el=>({text:el.textContent,display:getComputedStyle(el.closest('.el-overlay')).display})),faults}))};
const boundary=(element,label)=>{check(visible(element),label+'不可见');const r=element.getBoundingClientRect();check(r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,label+'超出视口 '+JSON.stringify({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}));return r};
const clickable=(element,label)=>{const r=boundary(element,label),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);check(element===top||element.contains(top),label+'被遮挡 '+JSON.stringify({target:element.className,top:top?.className}))};
const setInput=(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))};
const messageButton=label=>[...one('.el-message-box').querySelectorAll('button')].find(button=>button.textContent.trim()===label);
const escape=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
// 合成触摸事件验证真实组件的手势分支，不冒充物理手指或系统输入法。
const touch=(target,type,points,changed=points)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{touches:{value:points.map(([clientX,clientY])=>({clientX,clientY}))},changedTouches:{value:changed.map(([clientX,clientY])=>({clientX,clientY}))}});target.dispatchEvent(event)};
const unlock=()=>document.querySelector('.customer-name-lock-input input').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
const checkLoadingLayout=(region,singleLine)=>{
  const spinner=region.querySelector('.tf2025-loading-spinner'),text=spinner.querySelector('span'),icon=spinner.querySelector('.tf2025-loading-spinner__icon');
  const host=boundary(region,'加载区域'),box=spinner.getBoundingClientRect(),label=text.getBoundingClientRect(),ring=icon.getBoundingClientRect();
  const availableWidth=region.clientWidth,availableLeft=host.left+region.clientLeft,availableHeight=region.clientHeight,availableTop=host.top+region.clientTop;
  check(Math.abs(box.width-availableWidth)<1&&Math.abs(box.left-availableLeft)<1&&Math.abs(box.height-availableHeight)<1&&Math.abs(box.top-availableTop)<1,'区域加载提示未铺满当前宽高 '+JSON.stringify({region:region.className,host:{width:availableWidth,height:availableHeight},box:{width:box.width,height:box.height}}));
  check(Math.abs((label.top+label.bottom)/2-innerHeight/2)<1,'区域加载提示未在当前视口垂直居中');
  const overlay=region.querySelector('.tf2025-loading-overlay').getBoundingClientRect();
  check(Math.abs(overlay.width-box.width)<1&&Math.abs(overlay.height-box.height)<1,'背景遮罩与反馈区域边界不一致');
  check(label.left>=box.left&&label.right<=box.right+1,'加载文字撑破提示框');
  check(Math.abs(ring.width-ring.height)<1&&ring.width>0,'加载圆环被挤压变形');
  const range=document.createRange();range.selectNodeContents(text);
  const lines=new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size;
  check(singleLine||innerWidth<=767?lines===1:lines>1,'加载提示换行策略错误');
  check(text.title===text.textContent,'加载提示没有保留完整文案');
  check(innerWidth<=767?getComputedStyle(text).textOverflow==='ellipsis':text.scrollWidth<=text.clientWidth+1,'加载文字未按响应式规则处理溢出');
  check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'加载导致页面横向溢出');
};
const runLoadingLayoutCase=async()=>{
  for(const view of ['table','loading-region']){
    state.tableLoading=false;state.narrowRegion=false;state.view=view;state.rows=[{name:'已有设备数据'}];await settle();
    state.tableLoading=true;
    for(const text of ['正在刷新客户贴膜记录...','正在刷新商品库存列表...','正在读取供应商入库记录...']){
      state.loadingText=text;await nextTick();checkLoadingLayout(one(view==='table'?'.fixture-table':'.fixture-loading-region'),true);
    }
    for(const text of ['正在刷新客户贴膜记录，请稍候核对历史服务资料。'.repeat(8),'LongLoadingTask'.repeat(24)]){
      state.loadingText=text;await nextTick();checkLoadingLayout(one(view==='table'?'.fixture-table':'.fixture-loading-region'),false);
    }
    if(view==='loading-region'){
      state.narrowRegion=true;state.loadingText='正在刷新客户贴膜记录...';await nextTick();checkLoadingLayout(one('.fixture-loading-region'),false);
    }
    state.tableLoading=false;await settle();check(!one('.tf2025-loading-spinner'),'切换文案后加载提示未清理');
  }
  state.narrowRegion=false;state.loadingText='正在刷新设备查询结果...';
};
const runTableLoadingCase=async(theme)=>{
  document.documentElement.dataset.theme=theme;state.view='table';state.rows=[];state.tableLoading=true;await settle();
  check(all('.tf2025-loading-spinner,.inline-loading').length===1,'首载等待重复');check(all('.tf2025-loading-spinner').length===0,'首载误显示刷新遮罩');
  state.tableLoading=false;await settle();check(all('.tf2025-loading-spinner,.inline-loading').length===0,'空数据完成后等待残留');
  state.tableLoading=true;await settle();check(all('.tf2025-loading-spinner,.inline-loading').length===1,'空表刷新同时显示读取占位和刷新遮罩');check(all('.tf2025-loading-spinner').length===1,'空表刷新没有区域反馈');
  const fallback=document.querySelector('.fixture-table .table-loading-row__block');check(getComputedStyle(fallback).visibility==='hidden'&&fallback.getBoundingClientRect().height>0,'刷新未隐藏占位或丢失占位高度');
  state.tableLoading=false;state.rows=[{name:'已有设备数据'}];await settle();
  state.tableLoading=true;await settle();check(one('.fixture-table').textContent.includes('已有设备数据'),'刷新清空旧数据');check(all('.tf2025-loading-spinner,.inline-loading').length===1,'有数据刷新等待重复');
  state.tableLoading=false;state.rows=[];await settle();check(all('.tf2025-loading-spinner,.inline-loading').length===0,'失败/空结果结束后等待残留');
  await runLoadingLayoutCase();
  state.view='section-loading';
  for(const size of ['compact','normal','large']){
    state.sectionSize=size;
    for(const narrow of [false,true]){
      state.narrowRegion=narrow;
      for(const text of ['正在读取适配商品...','正在读取供应商商品资料，请稍候核对。'.repeat(6),'LongLoadingTask'.repeat(20)]){
        state.loadingText=text;await nextTick();
        const content=one('.fixture-loading-form .el-form-item__content'),section=one('.fixture-loading-form .section-loading'),label=section.querySelector('.inline-loading__text'),icon=section.querySelector('.inline-loading__spinner');
        const host=content.getBoundingClientRect(),box=section.getBoundingClientRect(),copy=label.getBoundingClientRect(),ring=icon.getBoundingClientRect();
        check(Math.abs(box.width-host.width)<1&&Math.abs(box.left-host.left)<1,'区块加载未铺满表单可用宽度 '+JSON.stringify({size,narrow,host:host.width,section:box.width}));
        check(copy.left>=box.left&&copy.right<=box.right+1,'区块加载文字溢出');
        check(label.title===text,'区块加载没有保留完整文案');
        check(innerWidth<=767?getComputedStyle(label).whiteSpace==='nowrap'&&getComputedStyle(label).textOverflow==='ellipsis':label.scrollWidth<=label.clientWidth+1,'区块加载文字未按响应式规则处理溢出');
        check(Math.abs(ring.width-ring.height)<1&&ring.width>0,'区块加载圆环变形');
        check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'区块加载导致横向溢出');
      }
    }
  }
  state.view='loading-overlay';state.loadingText='正在刷新商品库存列表...';await nextTick();
  for(const narrow of [false,true]){
    state.narrowRegion=narrow;await nextTick();
    const host=one('.fixture-loading-overlay').getBoundingClientRect(),cover=one('.loading-overlay-region__cover').getBoundingClientRect(),section=one('.loading-overlay-region__cover .section-loading').getBoundingClientRect();
    check([cover,section].every(box=>Math.abs(box.width-host.width)<1&&Math.abs(box.height-host.height)<1&&Math.abs(box.left-host.left)<1&&Math.abs(box.top-host.top)<1),'公共覆盖层的背景或反馈未铺满当前宽高');
  }
  state.narrowRegion=false;state.loadingText='正在刷新设备查询结果...';
  state.view='dialog';await settle();
  return {theme,case:'表格等待互斥、区域背景及反馈铺满宽高、区块全宽、手机单行省略及圆环边界'};
};
window.runLoadingSmoke=async()=>({ok:true,results:[await runTableLoadingCase('light'),await runTableLoadingCase('dark')],width:innerWidth,height:innerHeight,standalone:matchMedia('(display-mode: standalone)').matches,userAgent:navigator.userAgent});
window.runInputSmoke=async()=>{
  if(window.fixtureLoadingOnly)return window.runLoadingSmoke();
  const results=[];
  for(const theme of ['light','dark']){
    document.documentElement.dataset.theme=theme;
    results.push(await runTableLoadingCase(theme));
    const originalOverflow=document.body.style.overflow;
    state.view='dialog';
    for(let attempt=0;attempt<3;attempt++){
      state.base=true;await settle();const panel=one('.fixture-base');boundary(panel,'公共弹窗');
      const label=panel.querySelector('.el-form-item__label'),expected=document.createElement('span');expected.style.color='var(--tf-dialog-body-text)';panel.append(expected);check(getComputedStyle(label).color===getComputedStyle(expected).color,'表单标签未读取公共弹窗文字颜色');expected.remove();
      const close=panel.querySelector('button[aria-label="关闭"],.el-dialog__headerbtn,.sheet-close');check(close,'缺少关闭按钮');clickable(close,'标题关闭');close.click();await settle();
      check(!state.base&&!one('.fixture-base'),'关闭后外壳残留');
      check(!one('.mobile-dialog-overlay')&&!one('.el-overlay'),'关闭后遮罩残留');
      check(document.body.style.overflow===originalOverflow,'关闭后滚动未恢复');
    }
    state.base=true;state.child=true;await settle();
    check(document.body.style.overflow==='hidden'&&getComputedStyle(document.body).overflowY==='hidden','嵌套未锁滚动');
    escape();await settle();check(!state.child&&state.base,'Escape未只关闭上层');
    check(document.body.style.overflow==='hidden'&&getComputedStyle(document.body).overflowY==='hidden','上层关闭提前解锁');
    const pending=confirmDelete();await until(()=>one('.el-message-box'),'确认框未打开');await settle();
    escape();await until(()=>!one('.el-message-box'),'确认框Escape未关闭');await pending;await settle();check(state.base,'确认框Escape误关下层');
    state.base=false;await settle();check(document.body.style.overflow===originalOverflow,'最终关闭未释放滚动锁');
    results.push({theme,case:'弹窗三次关闭重开、嵌套Escape、确认层与滚动恢复'});

    for(const view of ['role','stores']){
      state.view=view;state.base=true;state.saving=false;state.submits=0;state.selectedStores=[];await settle();
      const panel=one('.permissions-dialog');boundary(panel,'权限表单');
      const buttons=[...panel.querySelectorAll('.tf-dialog-actions button')],save=buttons.at(-1),cancel=buttons.at(-2);
      if(view==='stores'){check(save.disabled,'未选门店可提交');state.selectedStores=[1];await settle()}
      clickable(save,'权限保存');save.click();await settle();check(state.submits===1,'权限保存未委托');
      state.saving=true;await settle();check(save.disabled&&save.querySelectorAll('.is-loading').length===1,'权限按钮未禁用或动画重复');boundary(save,'等待中的权限按钮');
      save.click();await settle();check(state.submits===1,'等待中重复提交');
      state.saving=false;await settle();check(!save.disabled&&!save.querySelector('.is-loading'),'失败后无法重试');save.click();await settle();check(state.submits===2,'重试未委托');
      clickable(cancel,'权限取消');cancel.click();await settle();check(!state.base&&!one('.el-message-box'),'权限取消再次确认');
      check(document.body.style.overflow===originalOverflow,'权限弹窗关闭未恢复滚动');
      results.push({theme,case:view+'真实权限弹窗、禁用/等待单动画/重试/直接取消'});
    }

    state.view='name';await settle();state.saved=[];state.name='测试姓名';
    unlock();await until(()=>one('.el-message-box input'),'姓名弹框未打开');await settle();
    unlock();await settle();check(all('.el-message-box').length===1,'姓名并发多开');
    const nameInput=one('.el-message-box input');
    setInput(nameInput,'   ');messageButton('确定').click();await settle();
    check(state.saved.length===0&&one('.el-message-box__errormsg')?.textContent.includes('单行客户姓名'),'空姓名未拦截或未显示错误');
    messageButton('取消').click();await until(()=>!prompting.value&&!one('.el-message-box'),'取消未解锁');await settle();check(state.saved.length===0&&state.name==='测试姓名','取消误保存');
    unlock();await until(()=>one('.el-message-box input'),'姓名取消后不能重开');await settle();
    setInput(one('.el-message-box input'),"  阿不都·O'Connor  ");messageButton('确定').click();
    await until(()=>!prompting.value&&!one('.el-message-box'),'姓名保存未结束');await settle();
    check(state.saved.length===1&&state.name==="阿不都·O'Connor",'姓名规范化/只保存一次失败');
    state.failSave=true;unlock();await until(()=>one('.el-message-box input'),'失败分支未打开');await settle();
    setInput(one('.el-message-box input'),'新姓名');messageButton('确定').click();await until(()=>!prompting.value&&!one('.el-message-box'),'失败未解锁');await settle();
    check(state.saved.length===1&&state.name==="阿不都·O'Connor",'保存失败改写原名');
    state.failSave=false;unlock();await until(()=>one('.el-message-box input'),'失败后不能重试');await settle();messageButton('取消').click();await until(()=>!prompting.value&&!one('.el-message-box'),'重试取消未解锁');await settle();
    check(!document.body.classList.contains('el-message-box-open')&&!document.getElementById('message-box-hide-tables'),'公共通知清理残留');
    results.push({theme,case:'姓名合成双击、并发、空值、取消、合法保存、失败重试'});

    state.view='dialog';state.base=true;state.index=29;state.media=true;await settle();
    const overlay=one('.media-preview-overlay'),stage=one('.media-preview-stage');boundary(overlay,'媒体预览');clickable(one('.media-preview-close'),'媒体关闭');
    const mobile=matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1023px)').matches;
    if(mobile){check(!one('.media-preview-nav')&&!one('.media-preview-zoom-actions'),'手机仍显示导航或缩放工具')}
    else{check(one('.media-preview-nav')&&one('.media-preview-zoom-actions'),'电脑导航或缩放工具缺失')}
    check(one('.media-preview-count').textContent.includes('30 / 30'),'长列表初始索引丢失');
    touch(stage,'touchstart',[[220,200]]);touch(stage,'touchend',[],[[100,200]]);await settle();
    check(one('.media-preview-count').textContent.includes('1 / 30'),'滑动未循环切换');
    touch(stage,'touchstart',[[100,200],[200,200]]);touch(stage,'touchmove',[[50,200],[250,200]]);touch(stage,'touchend',[],[[50,200],[250,200]]);await settle();
    check(one('.media-preview-content').style.transform.includes('scale(2)'),'双指缩放分支失败');clickable(one('.media-preview-close'),'放大后关闭');
    touch(stage,'touchstart',[[200,220]]);touch(stage,'touchmove',[[120,220]]);touch(stage,'touchend',[],[[120,220]]);await settle();
    check(one('.media-preview-count').textContent.includes('1 / 30'),'放大拖动误翻页');
    state.actions=true;await settle();one('.media-preview-delete').click();await until(()=>one('.el-message-box'),'媒体删除确认未打开');
    const confirmation=one('.el-message-box');
    const cancelDelete=messageButton('取消');
    await settle();
    boundary(confirmation,'媒体删除确认');
    clickable(cancelDelete,'媒体确认取消');
    cancelDelete.click();
    check(confirmation,'缺少确认');
    escape();await settle();check(state.media&&state.base&&!one('.el-message-box'),'媒体确认层关闭异常');
    one('.media-preview-close').click();await settle();check(!state.media&&state.base&&document.body.style.overflow==='hidden','媒体关闭误解锁/误关下层');
    state.base=false;state.actions=false;await settle();check(document.body.style.overflow===originalOverflow,'媒体最终关闭未恢复滚动');
    results.push({theme,case:'30张媒体索引/循环、合成滑动缩放拖动、关闭命中、删除确认层级'});

    for(const kind of ['wholesale','sales']){
      state.view='header-'+kind;await settle();
      const states=kind==='wholesale'?[{}, {passwordVerified:true}, {passwordVerified:true,usedModelsLoading:true}, {passwordVerified:true,usedModelsLoading:false,isGenerating:true}]:[{}, {isGenerating:true}];
      for(const values of states){
        window.updatePriceHeader(values);await settle();
        check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'报价页头横向溢出');
        const buttons=all('.price-header-action');check(buttons.length===(kind==='sales'?1:values.passwordVerified?4:2),'报价按钮数量不符');
        for(const button of buttons){boundary(button,'报价按钮');const text=button.querySelector('.btn-text')||button.querySelector('.btn-content');check(text&&text.scrollWidth<=text.clientWidth+1,'报价文字截断');if(!button.disabled)clickable(button,'报价按钮')}
      }
      state.view='save-'+kind;await settle();
      await Promise.all([...document.querySelectorAll('.ios-save-image')].map(image=>image.decode()));
      const panel=one('.ios-image-dialog');boundary(panel,'保存图片弹窗');
      const buttons=[...panel.querySelectorAll('.tf-dialog-actions button')];check(buttons.length===3,'保存图片缺少三个按钮');buttons.forEach(button=>clickable(button,'保存图片按钮'));
      const body=panel.querySelector('.mobile-dialog-body,.el-dialog__body,.sheet-body');check(body&&body.scrollHeight>body.clientHeight,'保存长图不能滚动');body.scrollTop=body.scrollHeight;await settle();check(body.scrollTop>0,'保存长图滚动失效');
      buttons.find(button=>button.textContent.trim()==='关闭').click();await settle();check(!one('.ios-image-dialog'),'保存图片关闭残留');
      results.push({theme,case:kind+'真实页头模板多状态、长图滚动与三个按钮边界'});
    }
    check(document.body.style.overflow===originalOverflow,'本组测试结束滚动锁残留');
  }
  check(!faults.length,'浏览器异常 '+faults.join(';'));
  state.view='header-wholesale';await settle();window.updatePriceHeader({passwordVerified:true});await settle();
  return {ok:true,results,width:innerWidth,height:innerHeight,standalone:matchMedia('(display-mode: standalone)').matches,userAgent:navigator.userAgent};
};
window.runFormLabelSmoke=async()=>{
  for(const theme of ['light','dark']){
    document.documentElement.dataset.theme=theme;state.view='dialog';state.base=true;await settle();
    const panel=one('.fixture-base'),label=panel.querySelector('.el-form-item__label'),expected=document.createElement('span');expected.style.color='var(--tf-dialog-body-text)';panel.append(expected);
    check(getComputedStyle(label).color===getComputedStyle(expected).color,'系统暗色覆盖公共标签 '+theme);expected.remove();
    state.base=false;await settle();
  }
  return {ok:true,systemDark:matchMedia('(prefers-color-scheme: dark)').matches};
};
window.fixtureReady=true;
if(location.search.includes('autorun'))window.runInputSmoke().then(result=>fetch('/__input-result',{method:'POST',body:JSON.stringify(result)})).catch(error=>fetch('/__input-result',{method:'POST',body:JSON.stringify({ok:false,error:error.message+'\\n'+error.stack})}));
`
