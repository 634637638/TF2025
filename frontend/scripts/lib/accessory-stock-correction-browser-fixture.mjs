import { mobileDetailEntry, mobileDetailMocks } from './mobile-detail-browser-fixture.mjs'

/** 真实库存页面及入库弹窗；采购/更正仅在内存中模拟，禁止访问业务API。 */
export const accessoryCorrectionEntry = mobileDetailEntry + `
window.fixtureOptions={categories:[{id:1,name:'充电器',status:1}],units:[{id:1,name:'个',status:1}],
 brands:[{id:1,name:'演示品牌',status:1},{id:2,name:'更正品牌',status:1}],model_brands:[],models:[],colors:[{id:1,name:'白色'}],
 suppliers:[{id:1,name:'原供应商',status:1},{id:2,name:'更正供应商',status:1}],stores:[{id:1,name:'演示仓库'}],default_store_id:1};
const stock={id:55,name:'演示充电器',category:'充电器',category_id:1,unit:'个',unit_id:1,brand_id:1,brand_name:'演示品牌',
 color_id:1,color_name:'白色',product_model:'MODEL-A',purchase_cost:10,sale_price:39,status:1,total_stock:50,total_in:50,total_out:0,
 remaining_stock:50,min_stock:5,serial_tracking:0};
window.fixtureScenario='plain';window.fixtureReads=[];window.fixtureProfile={};window.fixtureStockFailure=false;window.fixtureStockReceipt=null;
window.fixtureTemplateReads=[];window.fixtureListReads=[];
window.fixtureColorTemplate={...structuredClone(stock),id:200,name:'多色充电器',brand_id:null,brand_name:null,
 color_id:null,color_name:null,barcode:null,total_stock:0,color_template_id:200,color_variants:[
 {accessory_id:201,color_id:1,color_name:'白色',barcode:'COLOR-W'},
 {accessory_id:202,color_id:2,color_name:'黑色',barcode:'COLOR-B'}]};
window.fixtureInitialColorTemplate=structuredClone(window.fixtureColorTemplate);
window.fixtureTemplates=Array.from({length:121},(_,index)=>({...structuredClone(stock),id:1000+index,
 name:index===120?'原装充电头及多设备适配的长名称用于手机窄屏完整换行':'原装充电头',
 brand_id:null,brand_name:null,product_model:index===120?'USB-C 20W-PRO':'USB-C 20W-'+index,
 compatible_model_names:'手机品牌 iPhone 17 / iPhone 17 Pro Max',serial_tracking:index===120?1:0}));
const currentProfile=()=>({...structuredClone(stock),...window.fixtureProfile});
window.fixtureRead=async(url,options={})=>{
 window.fixtureReads.push(url);
 const pagination={page:1,page_size:20,total:1,total_pages:1};
 if(url==='/accessories'&&window.fixtureScenario==='model-summary'){
  const data=[
   {...currentProfile(),id:55,name:'通用商品模板'},
   {...currentProfile(),id:56,name:'跨品牌商品模板',compatible_brand_names:'苹果 / 华为',compatible_model_names:'苹果 iPhone 17, 苹果 iPhone 16, 华为 Mate 80'},
   {...currentProfile(),id:57,name:'多型号商品模板',compatible_brand_names:'苹果',compatible_model_names:Array.from({length:40},(_,i)=>'苹果 iPhone 代际 '+(i+1)+' Pro Max').join(', ')}
  ];
  return {success:true,data:{data,pagination:{...pagination,total:data.length}}};
 }
 if(url==='/accessories'&&window.fixtureScenario==='list-filters'){
  window.fixtureListReads.push(structuredClone(options.params));
  return {success:true,data:{data:[currentProfile()],pagination}};
 }
 if(url==='/accessories/catalog')return {success:true,data:{categories:[{id:1,name:'充电器',sort_order:0,status:1}],units:[{id:1,name:'个',sort_order:0,status:1}],film_ready:['template-colors','template-color-edit'].includes(window.fixtureScenario)}};
 if(url==='/accessories/settings')return {success:true,data:{warehouse_store_id:1,stores:[{id:1,name:'演示仓库',status:1}]}};
 if(['template-colors','template-color-edit'].includes(window.fixtureScenario)){
  if(url==='/accessories/stock-in/templates'||url==='/accessories'&&options.params?.mode==='templates')return {success:true,data:{data:[window.fixtureScenario==='template-color-edit'&&!window.fixtureProfile.color_template_id?currentProfile():structuredClone(window.fixtureColorTemplate)],pagination}};
  const templateDetail='/accessories/stock-in/templates/';
  if([templateDetail+window.fixtureColorTemplate.id,...window.fixtureColorTemplate.color_variants.map(row=>templateDetail+row.accessory_id)].includes(url)){
   const template=structuredClone(window.fixtureColorTemplate), variant=template.color_variants.find(row=>url===templateDetail+row.accessory_id);
   return {success:true,data:variant?{...template,id:variant.accessory_id,color_id:variant.color_id,color_name:variant.color_name,barcode:variant.barcode}:template};
  }
 }
 if(window.fixtureScenario==='template-search'){
  if(url==='/accessories/stock-in/templates'){
   const {page=1,page_size=20,search=''}=options.params;
   window.fixtureTemplateReads.push({page,search});
   const normalized=value=>String(value??'').toLowerCase().replace(/[\\s-]/g,'');
   const words=search.trim().split(/\\s+/).filter(Boolean);
   const rows=window.fixtureTemplates.filter(item=>words.every(word=>
    ['name','category','product_model','color_name','compatible_model_names'].some(key=>normalized(item[key]).includes(normalized(word)))));
   return {success:true,data:{data:structuredClone(rows.slice((page-1)*page_size,page*page_size)),pagination:{page,page_size,total:rows.length}}};
  }
  const template=window.fixtureTemplates.find(item=>url==='/accessories/stock-in/templates/'+item.id);
  if(template)return {success:true,data:structuredClone(template)};
 }
 if(url==='/accessories')return {success:true,data:{data:[currentProfile()],pagination}};
 if(url==='/accessories/55')return {success:true,data:currentProfile()};
 if(url==='/accessories/stock-in/templates/55')return {success:true,data:currentProfile()};
 if(url==='/accessories/55/stock-in-options')return {success:true,data:{data:[{purchase_id:10,batch_no:'IN-DEMO',
  supplier_name:'原供应商',store_name:'演示仓库',quantity:50,purchase_cost:currentProfile().purchase_cost}],pagination}};
 if(url==='/accessories/stock-in/10/edit'){
  if(window.fixtureHoldCorrection)await new Promise(resolve=>{window.fixtureReleaseCorrection=()=>{window.fixtureHoldCorrection=false;resolve()}});
  if(window.fixtureScenario==='legacy')throw {response:{status:409,data:{code:'STOCK_CORRECTION_UNTRACKED',message:'历史入库缺少原资料快照，请先核对，不能直接更正'}}};
  const sn=window.fixtureScenario==='serial';
  return {success:true,data:{purchase_id:10,batch_no:'IN-DEMO',inventory_time:'2026-11-13 10:00:00',operator_name:'演示操作员',
   accessory:structuredClone(stock),supplier_id:1,supplier_name:'原供应商',store_id:1,store_name:'演示仓库',total_quantity:sn?2:50,
   purchase_cost:currentProfile().purchase_cost,usage_type:'sale',serial_tracking:sn?1:0,remarks:'原备注',serial_numbers:sn?[
    {serial_number:'SN-A',store_id:1},{serial_number:'SN-B',store_id:1}]:[]}};
 }
 if(url==='/accessories/55/stock')return {success:true,data:{stores:[{store_id:1,store_name:'演示仓库',quantity:50,plain_quantity:50,serial_quantity:0}],total_stock:50}};
 if(['/accessories/55/batches','/accessories/55/serials','/accessories/55/transfers'].includes(url))return {success:true,data:{data:[],pagination:{...pagination,total:0,total_pages:0}}};
 window.fixtureUnknown.push(url);throw Error('未声明的隔离读取 '+url);
};
window.fixtureWrite=async(url,payload)=>{
 if(window.fixtureScenario==='template-colors'&&(url==='/accessories'||url==='/accessories/stock-in')){
  window.fixtureWrites.push(JSON.parse(JSON.stringify({url,payload})));
  if(url==='/accessories')return {success:true,data:structuredClone(window.fixtureColorTemplate)};
  const receipt=(entry,index)=>({stock_in_id:40+index,batch_no:'IN-COLOR-'+index,accessory_id:entry.accessory_id,
   quantity:entry.total_quantity,total_amount:entry.total_quantity*Number(entry.purchase_cost),inventory_time:entry.inventory_time||'2026-11-15 12:00:00',replayed:false});
  const result=payload.entries?{batches:payload.entries.map(receipt),replayed:false}:receipt(payload,0);
  if(window.fixtureStockFailure){window.fixtureStockFailure=false;window.fixtureStockReceipt=structuredClone(result);throw Error('隔离模拟提交成功但响应中断');}
  if(window.fixtureStockReceipt){const replay=structuredClone(window.fixtureStockReceipt);replay.replayed=true;replay.batches.forEach(row=>{row.replayed=true;});window.fixtureStockReceipt=null;return {success:true,data:replay};}
  return {success:true,data:result};
 }
 if(url==='/accessories/55'){
  if(window.fixtureScenario==='template-color-edit'&&payload.color_variants){
   const previous=window.fixtureProfile.color_variants||[{accessory_id:55,color_id:1,color_name:'白色',barcode:window.fixtureProfile.barcode}];
   const variants=payload.color_variants.map(row=>({...row,accessory_id:previous.find(item=>item.color_id===row.color_id)?.accessory_id||200+row.color_id,
    color_name:window.fixtureOptions.colors.find(color=>color.id===row.color_id)?.name}));
   Object.assign(window.fixtureProfile,payload,{color_template_id:200,color_variants:variants,color_id:1,barcode:variants[0].barcode});
   window.fixtureColorTemplate={...currentProfile(),id:200,brand_id:null,brand_name:null,color_id:null,color_name:null,barcode:null};
  }
  if(window.fixtureScenario==='link')Object.assign(window.fixtureProfile,payload);
  window.fixtureWrites.push(JSON.parse(JSON.stringify({url,payload})));
  return {success:true,data:{...structuredClone(stock),...payload}};
 }
 if(url!=='/accessories/stock-in/10/corrections'){window.fixtureUnknown.push(url);throw Error('禁止非更正业务写入')}
 window.fixtureProfile={...window.fixtureProfile,purchase_cost:Number(payload.purchase_cost)};
 window.fixtureWrites.push(JSON.parse(JSON.stringify({url,payload})));
 return {success:true,data:{stock_in_id:11,batch_no:'IN-CORRECTED',accessory_id:55,quantity:payload.total_quantity,
  total_amount:payload.total_quantity*Number(payload.purchase_cost),inventory_time:'2026-11-13 10:00:00',replayed:false}};
};
`

export function accessoryCorrectionMocks(root) {
  const mocks = mobileDetailMocks(root)
  mocks.set(`${root}/src/services/reference-options.ts`, 'export const getAccessoryEntryOptions=async()=>({success:true,data:{...structuredClone(window.fixtureOptions),film_ready:["template-colors","template-color-edit"].includes(window.fixtureScenario)}});')
  return mocks
}
