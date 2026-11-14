// 真实页面、公共详情及实际CSS；所有服务读取仅使用内存样本，写入直接拒绝。
export const mobileDetailEntry = `
import {createApp,h,nextTick,defineAsyncComponent,reactive} from 'vue';
import {createPinia} from 'pinia';
import {createRouter,createMemoryHistory} from 'vue-router';
import ElementPlus from 'element-plus';
import * as icons from '@element-plus/icons-vue';
import {vTableDoubleTap} from '/src/directives/table-double-tap.ts';
import {vPermission} from '/src/directives/permission.ts';
import {getTextColumnMinWidth,getAdaptiveActionColumnWidth,getNumberColumnMinWidth} from '/src/utils/table-layout.ts';
import {applyDeviceRootClass} from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/admin-layout.css';import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';import '/src/styles/components/_dialog-actions.scss';
window.fixtureAccess=reactive({readonly:false});window.fixtureWrites=[];window.fixtureNotices=[];window.fixtureUnknown=[];
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="orange"/></svg>');
const date='2026-11-13 10:00:00';
const announcement={id:1,title:'隔离公告',content:'<p>长正文用于检查手机完整换行</p>',link_url:'',is_pinned:true,is_enabled:true,sort_order:1};
const link={id:3,category_id:2,title:'隔离链接',description:'链接长说明'.repeat(8),url:'https://example.invalid/long-path',link_type:'url',is_enabled:true,sort_order:1};
const category={id:2,parent_id:null,name:'测试分类',description:'分类说明',icon:'fas fa-list',sort_order:1,is_enabled:true,access_mode:'public',locked:false,links:[link],children:[]};
const post={id:4,title:'隔离经验',content:'<p>经验正文</p>',category:'未分类',visibility:'public',is_pinned:false,author_id:1,author:'演示操作员',created_at:date,updated_at:date,attachments:[]};
const serial={id:1,serial_number:'00SN-1234567890',status:'in_stock',store_name:'演示仓库',batch_no:'IN-20261113',supplier_name:'演示供应商',purchase_cost:12.5,inventory_time:date,inventory_operator_name:'演示操作员',sale_no:'SO-20261113',customer_name:'演示客户',customer_phone:'13900000000',operator_name:'演示操作员',sale_time:date};
const transfer={id:1,from_store_name:'演示仓库',to_store_name:'演示门店',quantity:2,serial_numbers:['00SN-1234567890'],operator_name:'演示操作员',created_at:date,remarks:'长备注'.repeat(30)};
const product={id:1,template_id:1,brand_id:1,brand_name:'演示品牌',model_id:1,model_name:'演示型号',color_id:1,color_name:'黑色',min_price:1999,sale_price:1999,price:1999,is_new:1,product_type:'new',sort_order:0,display_text:'演示商品'};
const phone={id:1,is_new:true,status:'in_stock',brand:'演示品牌',model:'演示型号',color:'黑色',memory:'128G',imei:'012345678901234',inventory_time:date,purchase_cost:1999};
const duplicateCheck={total:2,duplicate_groups:1,duplicates:[{key:'演示品牌',primary:{id:1,name:'演示品牌',sort_order:1},duplicates:[{id:2,name:'演示品牌',sort_order:2}],count:2}]};
const datasets={
 '/shop/banners':[{id:1,title:'隔离轮播',image_url:image,images:[image],link_type:'none',sort_order:1,status:'active',interval:3000}],
 '/home/sections':[{id:1,section_key:'test',section_name:'测试区域',section_type:'products',is_enabled:true,sort_order:1,product_limit:10,product_count:0}],
 '/home/sections/1/products':[product],'/home/products/search':[product],
 '/shop/templates':[{id:1,brand_id:1,model_id:1,color_id:1,memory_ids:[1],template_name:'隔离模板',brand_name:'演示品牌',model_name:'演示型号',color_name:'黑色',price_markup:0,price_markup_type:'fixed',is_active:true,is_published:true,sort_order:1,images:[],stock_count:2}],
 '/shop/sold-products':[{id:1,brand:'演示品牌',model:'演示型号',color:'黑色',memory:'128G',imei:'012345678901234',sale_time:date,image_count:1}],
 '/guide':{settings:{site_title:'导航测试',site_eyebrow:'TEST',footer_text:'TEST'},announcements:[announcement],categories:[category]},
 '/shared':[post],'/shared/categories':[{name:'未分类',total:1}],'/shared/4':post,
 '/system/announcements/admin':[{...announcement,isPublished:true,isPinned:true,expiresAt:null,updatedAt:date}],
 '/git/status':{branch:'main',hasChanges:false,changes:[],aheadCount:0,behindCount:0,recentCommits:[]},
 '/git/log?limit=20':{commits:[{hash:'0123456789abcdef',author:'演示作者',date,message:'隔离提交\\n详细说明'}]},
 '/accessories/1/serials':{data:[serial],pagination:{total:1}},
 '/accessories/1/stock':{stores:[{store_id:1,store_name:'演示仓库',quantity:5,serial_quantity:2,plain_quantity:3}]},
 '/accessories/1/transfers':{data:[transfer],pagination:{total:1}},
 '/screen-lock':{},'/screen-lock/query-users':[{id:1,name:'演示查询账号',is_active:true,remarks:'隔离备注'}],
 '/data-check/statistics':{brands:2},'/data-check/check/all':{details:{brands:duplicateCheck}},
 '/dashboard/warnings/comprehensive':{phones:{warnings:[{brand_name:'演示品牌',model_name:'演示型号',color_name:'黑色',memory_name:'128G',current_stock:1,threshold:3}],count:1},accessories:{warnings:[{name:'演示配件',current_stock:1,min_stock:3}],count:1},purchases:{no_recent:[{supplier_name:'演示供应商',last_purchase_date:date,days_since_purchase:8}],recent:[]}}
};
window.fixtureRead=async url=>{if(Object.hasOwn(datasets,url))return {success:true,data:structuredClone(datasets[url]),pagination:{total:1}};window.fixtureUnknown.push(url);throw Error('未声明的隔离读取 '+url)};
window.fixtureWrite=(...args)=>{window.fixtureWrites.push(args);throw Error('本测试禁止业务写入')};
const imports=import.meta.glob('/src/**/*.vue');let app;
const globals=['MobileDialog','RecordDetailDialog','RecordDescriptions','DataEmptyState','TableLoadingRow','SectionLoading','Pagination','AmountInput','DateRangePicker','MediaPreviewViewer','IconRenderer','PageHeader'];
window.renderMobileCase=async(file,readonly=false)=>{
 app?.unmount();await nextTick();window.fixtureAccess.readonly=readonly;window.fixtureNotices=[];window.fixtureUnknown=[];
 const component=(await imports['/src/'+file]()).default;
 app=createApp({render:()=>h(component,file.startsWith('components/Accessory')?{accessoryId:1}:file.endsWith('/AnnouncementManagementCard.vue')?{canEdit:!readonly,canDelete:!readonly}:file.endsWith('/SalesGridView.vue')?{phones:[phone],loading:false,hasActiveFilters:false,canViewField:()=>true,canViewPrice:!readonly,canSell:!readonly,canEdit:!readonly,canDelete:!readonly,getPhoneImageSrc:()=>image,formatDate:value=>value||'-'}:{})});
 app.use(createPinia());const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});app.use(router);await router.push('/fixture');await router.isReady();app.use(ElementPlus);
 for(const[name,icon]of Object.entries(icons))app.component(name,icon);
 for(const name of globals){const key=Object.keys(imports).find(key=>key.endsWith('/'+name+'.vue'));if(key)app.component(name,defineAsyncComponent(imports[key]));}
 app.directive('table-double-tap',vTableDoubleTap);app.directive('permission',vPermission);app.directive('tf-loading',{});
 Object.assign(app.config.globalProperties,{$getNumberColumnWidth:getNumberColumnMinWidth,$getTextColumnWidth:getTextColumnMinWidth,$getActionColumnWidth:getAdaptiveActionColumnWidth});
 app.provide('registerHeaderActions',()=>{});app.provide('clearHeaderActions',()=>{});applyDeviceRootClass();app.mount('#app');await nextTick();
};
window.fixtureReady=true;
`

export function mobileDetailMocks(root) {
  const module = relative => `${root}/src/${relative}`
  return new Map([
    [module('utils/unified-api.ts'), 'export const unifiedApi={get:(...args)=>window.fixtureRead(...args),post:(...args)=>window.fixtureWrite(...args),put:(...args)=>window.fixtureWrite(...args),delete:(...args)=>window.fixtureWrite(...args),upload:(...args)=>window.fixtureWrite(...args)};export {unifiedApi as api};export default unifiedApi;export {extractBlobResponse} from \'/src/utils/download-response.ts\';'],
    [module('stores/auth.ts'), 'const allowed=permission=>permission.endsWith(\':view\')||!window.fixtureAccess.readonly;export const useAuthStore=()=>({get userPermissions(){return window.fixtureAccess.readonly?[\'system:view\',\'guide:view\',\'shared:view\',\'h5-banners:view\',\'home-sections:view\',\'h5-templates:view\',\'h5-sold-products:view\',\'git-management:view\']:[\'*\']},hasPermission:allowed,hasAnyPermission:permissions=>permissions.some(allowed),hasAllPermissions:permissions=>permissions.every(allowed),get isSuperAdmin(){return !window.fixtureAccess.readonly},isAuthenticated:true,isActive:true,user:{id:1,name:\'演示操作员\'}});'],
    [module('composables/useFieldPermissions.ts'), 'export const shouldShowActionColumn=(visible,actions)=>visible||actions.some(Boolean);export const fieldPermissions={isFieldVisible:()=>true,isFieldEditable:()=>!window.fixtureAccess.readonly,init:async()=>{}};export const useFieldPermissions=()=>fieldPermissions;'],
    [module('composables/index.ts'), 'export {useLoadingState} from \'/src/composables/useLoading.ts\';export {ValidationRules,useForm} from \'/src/composables/forms/useForm.ts\';'],
    [module('composables/useNotification.ts'), 'const notice=kind=>message=>window.fixtureNotices.push({kind,message});export const useNotification=()=>({success:notice(\'success\'),error:notice(\'error\'),warning:notice(\'warning\'),info:notice(\'info\'),confirm:async()=>{throw Error(\'本测试禁止危险确认\')}});'],
    [module('api/base-data.ts'), 'const read=async()=>({data:[]});export const baseDataApi={getBrands:read,getModels:read,getColors:read,getMemories:read,getAdminBrands:read,getAdminModels:read,getAdminColors:read,getAdminMemories:read};export default baseDataApi;'],
    [module('stores/siteSettings.ts'), 'import{reactive}from\'vue\';const settings=reactive({logoUrl:\'\',siteName:\'隔离站点\',siteSubtitle:\'\',siteDomain:\'\',icpNumber:\'\',companyName:\'\',contactPhone:\'\',contactEmail:\'\',companyAddress:\'\',publicPriceContacts:\'演示联系人|13900000000\',publicPriceDefaultContact:\'\',publicPriceWatermark:\'\',publicPriceWatermarkEnabled:\'1\',publicPriceWatermarkTimeEnabled:\'1\',publicPriceWatermarkColor:\'#6b7280\'});export const useSiteSettingsStore=()=>({settings,isLoading:false,loadSiteSettings:async()=>{},updateSiteSettings:(...args)=>window.fixtureWrite(...args)});'],
    [module('utils/error-logger.ts'), 'import{ref,computed}from\'vue\';export{ErrorLevel,ErrorType}from\'/src/utils/error-boundary.ts\';const row={id:\'fixture-error\',timestamp:1794535200000,formattedTime:\'2026-11-13 10:00:00\',level:\'medium\',type:\'network\',message:\'隔离错误示例\',url:\'/fixture\',userAgent:\'isolated browser\',count:2,lastOccurred:1794535200000,resolved:false,reported:false};const logs=ref([row]);const statistics=computed(()=>({total:2,unresolved:2,reported:0,errorRate:0,byLevel:{medium:2},byType:{network:2},byHour:{},byComponent:{},mostCommonErrors:[{message:row.message,count:row.count,lastOccurred:row.lastOccurred}]}));export const useErrorLogger=()=>({logs,statistics,getLogs:()=>logs.value,resolveError:()=>window.fixtureWrite(\'resolveError\'),removeError:()=>window.fixtureWrite(\'removeError\'),exportLogs:()=>\'\',clearLogs:()=>window.fixtureWrite(\'clearLogs\')});export const globalErrorLogger={logError:()=>{}};export default globalErrorLogger;'],
    [module('utils/temp-file-cleaner.ts'), 'export const deleteTempFiles=async files=>{if(files.length)window.fixtureWrite(\'deleteTempFiles\',files);return true};']
  ])
}
