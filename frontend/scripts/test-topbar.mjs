#!/usr/bin/env node
// 使用实际导航壳及菜单模板和样式；业务脚本替换为内存状态，不登录或调用业务接口。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = resolve(import.meta.dirname, '..')
const { default: puppeteer } = createRequire(resolve(root, '../backend/package.json'))('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-topbar-'))
const shellFile = resolve(root, 'src/views/system/page/SimpleAdminView.vue')
const menuFile = resolve(root, 'src/components/ResponsiveMenu.vue')
const shellScript = `
import {ref,computed,defineComponent} from 'vue';
import {Lock,Unlock,SwitchButton} from '@element-plus/icons-vue';
import ResponsiveMenu from '@/components/ResponsiveMenu.vue';
const props=defineProps({compact:Boolean,name:String,role:String});
const empty=defineComponent({render:()=>null});
const ScreenLock=empty,SimpleSidebar=empty,NotificationContainer=empty,ReminderHost=empty,RouterView=empty;
const TabsBar=defineComponent({template:'<div>首页</div>'});
const isDesktopLayout=computed(()=>!props.compact),isLocked=ref(false),sidebarCollapsed=ref(false),isScrolled=ref(false);
const isAuthenticated=true,authUser=computed(()=>({name:props.name})),userRoleText=computed(()=>props.role),beijingTime='09:30:00';
const menuItems=[],quickActions=[],responsiveMenuRef=ref(),contentAreaRef=ref();
const handleLockStateChange=value=>{isLocked.value=value};
const toggleScreenLock=()=>{isLocked.value=!isLocked.value};
const handleLogout=()=>{window.fixture.logout++};
const handleMenuNavigation=()=>{},getRouteCacheKey=()=>'',isRefreshingCurrentRoute=()=>false;
`
const menuScript = `
import {ref,defineComponent} from 'vue';
import IconRenderer from './IconRenderer.vue';
import menuBarsIcon from '@/assets/icons/menu-bars.svg?raw';
defineProps({showMenuButton:Boolean,menuItems:Array,enableGestures:Boolean,quickActions:Array});
const MobileSlideMenu=defineComponent({render:()=>null});
const isDrawerNavigation=true,isSlideMenuOpen=ref(false),isMenuLoading=false,slideMenuItems=[],userInfo={name:'',role:''},activeQuickActions=[];
const closeSlideMenu=()=>{isSlideMenuOpen.value=false},handleMenuButtonClick=()=>{isSlideMenuOpen.value=!isSlideMenuOpen.value};
const forwardMenuClick=()=>{},handleQuickAction=()=>{};
`
const entry = `
import {createApp,h,reactive,nextTick} from 'vue';
import ElementPlus from 'element-plus';
import Shell from '/src/views/system/page/SimpleAdminView.vue';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/responsive.scss';import '/src/styles/admin-layout.css';
window.fixture=reactive({compact:true,name:'Boss',role:'管理员',logout:0});
const app=createApp({render:()=>h(Shell,window.fixture)});app.use(ElementPlus);app.mount('#app');
window.updateTopbar=async values=>{
 Object.assign(window.fixture,values);await nextTick();await new Promise(requestAnimationFrame);
 await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
};
window.ready=true;
`
let server, browser
try {
  server = await createServer({ root,configFile:false,envFile:false,logLevel:'error',cacheDir:join(temporary,'vite'),
    resolve:{ alias:{ '@':resolve(root,'src') } }, optimizeDeps:{ include:['vue','element-plus'] },
    plugins:[vue(),{ name:'isolated-topbar',enforce:'pre',
      resolveId:id=>id==='/__topbar.js'?'\0topbar-entry':undefined,
      async load(id) {
        if(id==='\0topbar-entry')return entry
        if(id!==shellFile&&id!==menuFile)return
        const source=await readFile(id,'utf8')
        return source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/,()=>'<script setup>'+ (id===shellFile?shellScript:menuScript) +'</script>')
      },
      configureServer(vite){vite.middlewares.use((req,res,next)=>{
        if(req.url==='/__topbar.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__topbar.js"></script></body></html>');return}
        if(req.method!=='GET'||req.url?.startsWith('/api/')){res.statusCode=403;res.end('禁止业务请求');return}
        next()
      })}
    }],server:{ host:'127.0.0.1',port:0,hmr:false,watch:null } })
  await server.listen()
  const origin=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await puppeteer.launch({ executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:join(temporary,'chrome') })
  const page=await browser.newPage(),errors=[],blocked=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request',request=>{
    if(request.url().startsWith(origin+'/')||request.url().startsWith('data:'))request.continue()
    else{blocked.push(request.url());request.abort()}
  })
  await page.goto(origin+'/__topbar.html',{ waitUntil:'networkidle0' })
  await page.waitForFunction('window.ready === true')
  let cases=0
  for(const width of [320,375,390,430,767,768,834,1024,1025,1440])for(const theme of ['light','dark']){
    await page.setViewport({ width,height:900,isMobile:width<768,hasTouch:width<768 })
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme)
    // 包含手机 Safari 桌面网站模式：宽视口仍由设备分支使用紧凑导航。
    for(const compact of width>=1025?[false,true]:[true])for(const name of ['Boss','姓名很长的测试员工姓名']){
      await page.evaluate(values=>window.updateTopbar(values),{ compact,name })
      const label=`${width}/${theme}/${compact?'compact':'desktop'}/${name}`
      const metrics=await page.evaluate(()=>{
        const box=element=>{const r=element.getBoundingClientRect();return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }}
        const topbar=document.querySelector('.topbar'),buttons=[...document.querySelectorAll('.tf-button--topbar')],card=document.querySelector('.topbar-actions .user-info')
        return { topbar:box(topbar),card:box(card),buttons:buttons.map(button=>({ ...box(button),margin:parseFloat(getComputedStyle(button).marginLeft),icon:box(button.querySelector('.el-icon')),labelVisible:button.querySelector('.topbar-button-label').getClientRects().length>0 })),
          menu:document.querySelector('.mobile-menu-button')?box(document.querySelector('.mobile-menu-button')):null,scroll:document.documentElement.scrollWidth }
      })
      const [lock,logout]=metrics.buttons,expectedHeight=width<768?Math.min(36,Math.max(34,width*0.096)):28
      assert.ok(Math.abs(lock.height-expectedHeight)<0.1,`${label} 锁屏高度 ${lock.height} 应跟随公共默认 ${expectedHeight}`)
      assert.equal(lock.height,logout.height,`${label} 两个按钮等高`)
      assert.ok(Math.abs(lock.height-metrics.card.height)<0.1,`${label} 用户信息与按钮等高`)
      assert.ok(Math.abs(metrics.topbar.right-logout.right-8)<0.1,`${label} 右侧仅保留8px公共留白，实际 ${metrics.topbar.right-logout.right}`)
      assert.ok(Math.abs(logout.left-lock.right-4)<0.1,`${label} 按钮间距仅4px公共gap，实际 ${logout.left-lock.right}`)
      for(const button of [lock,logout]){
        assert.equal(button.margin,0,`${label} 不叠加Element相邻按钮外边距`)
        assert.equal(button.labelVisible,!compact,`${label} 只隐藏标签，不隐藏Element按钮内容容器`)
        assert.ok(button.icon.width>0&&button.icon.height>0,`${label} 图标可见`)
        assert.ok(Math.abs((button.icon.left+button.icon.right)/2-(button.left+button.right)/2)<1||!compact,`${label} 纯图标居中`)
        if(compact)assert.ok(Math.abs(button.width-button.height)<0.1,`${label} 纯图标按钮必须方形`)
        assert.ok(button.left>=0&&button.right<=width,`${label} 按钮完整可见`)
      }
      assert.ok(metrics.card.right<=lock.left&&metrics.card.width>0,`${label} 用户信息不遮挡按钮`)
      assert.ok(metrics.scroll<=width,`${label} 页面不横向溢出`)
      if(compact)assert.ok(metrics.menu.right<=metrics.card.left,`${label} 菜单不遮挡用户卡片`)
      if(width===390&&theme==='light'&&name==='Boss'&&process.env.TOPBAR_SCREENSHOT)await page.screenshot({ path:process.env.TOPBAR_SCREENSHOT,clip:{ x:0,y:0,width,height:Math.ceil(metrics.topbar.height) } })
      await page.click('.btn-lock')
      assert.equal(await page.$eval('.btn-lock',element=>element.title),'解锁屏幕',`${label} 锁屏动作正常`)
      await page.click('.btn-lock')
      assert.equal(await page.$eval('.btn-lock',element=>element.title),'锁定屏幕',`${label} 解锁动作正常`)
      const before=await page.evaluate(()=>window.fixture.logout)
      await page.click('.logout-btn')
      assert.equal(await page.evaluate(()=>window.fixture.logout),before+1,`${label} 退出按钮点击可达`)
      cases++
    }
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(blocked,[])
  console.log(`顶部栏浏览器回归通过：${cases}组；实际导航模板/样式、10个视口、明暗、长姓名及紧凑设备分支；无真实登录、锁屏或退出请求。`)
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary,{ recursive:true,force:true })
}
