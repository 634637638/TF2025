// 隔离真实积分设置和公共样式，30商品/8类型长文本；不连接业务接口。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const root=resolve(import.meta.dirname,'..')
const requireFrontend=createRequire(resolve(root,'package.json'))
const { createServer }=await import(requireFrontend.resolve('vite'))
const { default:vue }=await import(requireFrontend.resolve('@vitejs/plugin-vue'))
const { default:puppeteer }=createRequire(resolve(root,'../backend/package.json'))('puppeteer')
const chrome=process.env.CHROME_BIN||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(existsSync)
assert.ok(chrome,'需要Chrome/Chromium进行浏览器验收')
const temporary=await mkdtemp(join(tmpdir(),'tf-points-layout-'))
const config={ enabled:true,amount_per_point:100,include_new:true,include_used:true,include_accessories:true,new_points_per_100:1,used_points_per_100:2,accessory_points_per_100:3,redemption:{ enabled:true,points_per_yuan:10,max_percent:20,sources:['accessory'],all_accessory_categories:false,category_ids:[4,5,6,7,8,9,10,11],accessory_ids:Array.from({ length:30 },(_,i)=>i+8) } }
const fixtureProducts=Array.from({ length:30 },(_,i)=>({ id:i+8,category_id:4+i%8,status:1,name:'很长的商品名称用于核对多选标签边界'+i,brand_name:'沃品',product_model:'PD-L',color_name:'黑色' }))
const fixtureCategories=Array.from({ length:8 },(_,i)=>({ id:i+4,name:'超长商品类型名称'+i,status:1 }))
const entry=`
import {createApp,h,ref} from 'vue';import {createPinia} from 'pinia';import ElementPlus from 'element-plus';
import Settings from '/src/views/customers/page/CustomerPointsSettings.vue';import MobileDialog from '/src/components/MobileDialog.vue';
import 'element-plus/dist/index.css';import '/src/styles.scss';import '/src/styles/responsive.scss';import '/src/styles/components/_dialog.scss';import '/src/styles/components/_dialog-actions.scss';
window.openPoints=ref(true);window.calls=[];window.readonly=false;window.fail=false;window.loading=false;
const app=createApp({render:()=>h(Settings,{modelValue:window.openPoints.value,'onUpdate:modelValue':v=>window.openPoints.value=v})});
app.use(createPinia());app.use(ElementPlus);app.component('MobileDialog',MobileDialog);app.directive('permission',{});app.mount('#app');window.ready=true;
`
let server,browser
try{
  server=await createServer({ root,configFile:false,envFile:false,logLevel:'error',cacheDir:join(temporary,'vite'),resolve:{ alias:{ '@':resolve(root,'src') } },optimizeDeps:{ noDiscovery:true,entries:[],include:['vue','pinia','element-plus','element-plus/es/components/focus-trap/index','dayjs','dayjs/plugin/customParseFormat','dayjs/plugin/timezone','dayjs/plugin/utc','dayjs/plugin/relativeTime','dayjs/locale/zh-cn'] },plugins:[vue(),{ name:'points-fixture',enforce:'pre',resolveId:id=>id==='/__points.js'?'\0points':undefined,load(id){
    if(id==='\0points')return entry
    if(id===resolve(root,'src/utils/unified-api.ts'))return `const config=${JSON.stringify(config)},products=${JSON.stringify(fixtureProducts)},categories=${JSON.stringify(fixtureCategories)};export const unifiedApi={get:async(url)=>{window.calls.push('get');if(url.endsWith('points-products'))return {success:true,data:products,pagination:{total:products.length}};if(window.loading)await new Promise(resolve=>window.finishLoading=resolve);if(window.fail)throw new Error('fixture');return {success:true,data:{config:structuredClone(config),products,categories}}},put:async(url,value)=>{window.calls.push({url,value:JSON.parse(JSON.stringify(value))});return {success:true}}};`
    if(id===resolve(root,'src/composables/usePagePermissions.ts'))return 'import {computed} from \'vue\';export const usePagePermissions=()=>({canView:computed(()=>true),canManage:computed(()=>!window.readonly)});'
    if(id===resolve(root,'src/composables/useNotification.ts'))return 'export const useNotification=()=>({success(){},warning(){}});'
  },configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__points.js"></script></body></html>')})} }],server:{ host:'127.0.0.1',port:0 } })
  await server.listen();const port=server.httpServer.address().port
  browser=await puppeteer.launch({ executablePath:chrome,headless:true,args:['--no-sandbox'] });const page=await browser.newPage();const errors=[],blocked=[]
  page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE',error.message)});await page.setRequestInterception(true);page.on('request',request=>{if(request.url().startsWith(`http://127.0.0.1:${port}/`)&&!request.url().includes('/api/'))request.continue();else{blocked.push(request.url());request.abort()}})
  let cases=0
  for(const width of [320,375,430,767,768,1440])for(const theme of ['light','dark']){
    await page.setViewport({ width,height:900,isMobile:width<768,hasTouch:width<768 });await page.goto(`http://127.0.0.1:${port}/`);await page.waitForSelector('form',{ timeout:15000 }).catch(async error=>{console.error(await page.evaluate(()=>document.body.innerText));throw error})
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,350)))
    const m=await page.evaluate(()=>{const dialog=[...document.querySelectorAll('[role=dialog]')].find(e=>e.getClientRects().length);const box=dialog.getBoundingClientRect();const body=dialog.querySelector('.el-dialog__body');return { left:box.left,right:box.right,scroll:body.scrollWidth,width:body.clientWidth,sections:dialog.querySelectorAll('section').length,fields:[...dialog.querySelectorAll('.el-input-number,.el-select,.el-checkbox')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return { left:r.left,right:r.right,text:e.textContent }}),theme:document.documentElement.dataset.theme }})
    assert.ok(m.left>=-1&&m.right<=width+1,JSON.stringify({ width,theme,m }));assert.ok(m.scroll<=m.width+1,JSON.stringify({ width,theme,m }));assert.equal(m.sections,2)
    for(const f of m.fields)assert.ok(f.left>=m.left&&f.right<=m.right+1,JSON.stringify({ width,theme,f,m }))
    await page.evaluate(()=>document.querySelector('.el-collapse-item__header').click())
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,350)))
    const review=await page.evaluate(()=>{const wrap=document.querySelector('.points-selected-products');const rows=[...document.querySelectorAll('.points-selected-products li')];return { count:rows.length,scroll:wrap.scrollHeight,height:wrap.clientHeight,selectors:[...document.querySelectorAll('.el-select__wrapper')].map(w=>{const r=w.getBoundingClientRect();return { top:r.top,bottom:r.bottom,items:[...w.querySelectorAll('.el-select__selected-item')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return { top:b.top,bottom:b.bottom }}) }}) }})
    assert.equal(review.count,30);assert.ok(review.scroll>review.height&&review.height>0)
    const panelHeight=await page.$eval('.el-collapse',element=>element.getBoundingClientRect().height)
    assert.ok(panelHeight<300,'已选清单不能产生多余空白 '+panelHeight)
    for(const select of review.selectors)for(const tag of select.items)assert.ok(tag.top>=select.top-1&&tag.bottom<=select.bottom+1,JSON.stringify({ width,theme,select,tag }))
    await page.evaluate(()=>{const body=document.querySelector('[role=dialog] .el-dialog__body');body.scrollTop=body.scrollHeight})
    if(process.env.POINTS_SCREENSHOT_DIR&&(width===375||width===1440)&&theme==='light')await page.screenshot({ path:join(process.env.POINTS_SCREENSHOT_DIR,`points-${width}.png`),fullPage:true })
    await page.evaluate(()=>{const form=document.querySelector('form');form.dispatchEvent(new Event('submit',{ bubbles:true,cancelable:true }))});await page.waitForFunction(()=>window.calls.some(call=>call.url),{ timeout:3000 }).catch(async error=>{console.error(await page.evaluate(()=>({ text:document.body.innerText,calls:window.calls })));throw error});const saved=await page.evaluate(()=>window.calls.find(call=>call.url).value);assert.deepEqual(saved,config);cases++
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log(`积分设置隔离浏览器通过 ${cases} 组：6视口、明暗、控件边界、双分区和原配置保存；无业务网络请求。`)
}finally{await browser?.close();await server?.close();await rm(temporary,{ recursive:true,force:true })}
