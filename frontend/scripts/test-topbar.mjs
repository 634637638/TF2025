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
const tabsFile = resolve(root, 'src/components/TabsBar.vue')
const scrollFixture = `
import {ElButton,ElTabs,ElTabPane} from 'element-plus';
const ScrollFixture=defineComponent({setup(){
 const active=ref(0),buttonTab=ref(0);
 const labels=Array.from({length:28},(_,index)=>'测试标签 '+(index+1));
 return ()=>h('section',{class:'admin-page','data-tabs-fixture':''},[
  h(ElTabs,{class:['tf-page-tabs',{'tf-page-tabs--transparent':window.fixture.publicPage}],modelValue:active.value,'onUpdate:modelValue':value=>{active.value=value}},
   ()=>labels.map((label,name)=>h(ElTabPane,{class:'tf-tab-panel',key:name,label,name}))),
  h('div',{class:'tf-page-tabs tab-navigation'},labels.map((label,index)=>h(ElButton,{
   key:index,type:buttonTab.value===index?'primary':'default',onClick:()=>{buttonTab.value=index}
  },()=>label))),
  h('div',{class:'tf-tab-content'},[
   h('div',{class:'tf-tab-panel'},[
    ...(window.fixture.longContent?[h('div',{style:{height:'1400px'}})]:[]),
    h('button',{type:'button','data-bottom':''},'内容末尾')
   ])
  ])
 ]);
}});
`
const shellScript = `
import {ref,computed,defineComponent,h} from 'vue';
import {Lock,Unlock,SwitchButton} from '@element-plus/icons-vue';
import ResponsiveMenu from '@/components/ResponsiveMenu.vue';
import TabsBar from '@/components/TabsBar.vue';
${scrollFixture}
const props=defineProps({compact:Boolean,name:String,role:String});
const empty=defineComponent({render:()=>null});
const ScreenLock=empty,SimpleSidebar=empty,NotificationContainer=empty,ReminderHost=empty;
const isDesktopLayout=computed(()=>!props.compact),isLocked=ref(false),sidebarCollapsed=ref(false),isScrolled=ref(false);
const isAuthenticated=true,authUser=computed(()=>({name:props.name})),userRoleText=computed(()=>props.role),beijingTime='09:30:00';
const menuItems=[],quickActions=[],responsiveMenuRef=ref(),contentAreaRef=ref();
const handleLockStateChange=value=>{isLocked.value=value};
const toggleScreenLock=()=>{isLocked.value=!isLocked.value};
const handleLogout=()=>{window.fixture.logout++};
const handleMenuNavigation=()=>{};
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
const tabsScript = `
import {ref} from 'vue';
import IconRenderer from '@/components/IconRenderer.vue';
const tabs=Array.from({length:28},(_,index)=>({path:String(index),title:'页面标签 '+(index+1),fixed:true}));
const activeTab=ref(tabs[0].path);
const switchTab=path=>{activeTab.value=path};
const closeTab=()=>{},handleCommand=()=>{};
`
const entry = `
import {createApp,h,reactive,nextTick,ref,defineComponent} from 'vue';
import ElementPlus from 'element-plus';
import Shell from '/src/views/system/page/SimpleAdminView.vue';
import 'element-plus/dist/index.css';
import '/src/styles.scss';import '/src/styles/responsive.scss';import '/src/styles/admin-layout.css';
import {initPageTabScroll} from '/src/utils/page-tab-scroll.ts';
${scrollFixture}
window.fixture=reactive({compact:true,name:'Boss',role:'管理员',logout:0,longContent:false,publicPage:false,viewportKey:0});
const app=createApp({render:()=>window.fixture.publicPage?h(ScrollFixture):h(Shell,{...window.fixture,key:window.fixture.viewportKey})});
app.use(ElementPlus);app.mount('#app');
initPageTabScroll();
window.updateTopbar=async values=>{
 Object.assign(window.fixture,values);await nextTick();await new Promise(requestAnimationFrame);
 await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
};
window.ready=true;
`

async function swipe(page, fromX, fromY, toX, toY) {
  const touch = await page.touchscreen.touchStart(fromX, fromY)
  for (let step = 1; step <= 6; step++) {
    await touch.move(fromX + (toX - fromX) * step / 6, fromY + (toY - fromY) * step / 6)
  }
  // End with the finger stationary so the test does not depend on fling distance.
  await new Promise(resolve => setTimeout(resolve, 120))
  await touch.end()
}

async function checkTabScrolling(page, width) {
  const mobile = width < 768
  await page.setViewport({ width, height: 820, isMobile: mobile, hasTouch: mobile })
  await page.evaluate(values => window.updateTopbar(values), { compact: width < 1025, longContent: false, viewportKey: width })
  const layout = () => page.$eval('.content-area', area => ({
    width: area.clientWidth,
    bottom: area.getBoundingClientRect().bottom,
    overscroll: getComputedStyle(area).overscrollBehaviorY,
    rootExtent: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    rootOverscroll: getComputedStyle(document.documentElement).overscrollBehaviorY
  }))
  const short = await layout()
  await page.evaluate(() => window.updateTopbar({ longContent: true }))
  const long = await layout()
  assert.equal(long.width, short.width, `${width} 短内容切换成长内容时宽度稳定`)
  assert.ok(long.bottom <= 820 && long.rootExtent <= 1, `${width} 正文底边在视口内且文档没有第二层纵向滚动`)
  assert.equal(long.overscroll, 'none', `${width} 后台正文在边缘取消滚动回弹`)
  assert.equal(long.rootOverscroll, 'none', `${width} 文档在边缘取消滚动回弹`)

  const rails = [
    '.tf-page-tabs .el-tabs__nav-scroll',
    '.tf-page-tabs.tab-navigation'
  ]
  if (width >= 1025) rails.push('.tf-topbar-tabs .tabs-container')
  for (const selector of rails) {
    const label = `${width} ${selector}`
    const rail = await page.$(selector)
    const bounds = await rail.boundingBox()
    const scroll = () => rail.evaluate(element => element.scrollLeft)
    const max = await rail.evaluate(element => element.scrollWidth - element.clientWidth)
    const styles = await rail.evaluate(element => {
      const style = getComputedStyle(element)
      return { scrollbar: style.scrollbarWidth, overscroll: style.overscrollBehaviorX }
    })
    assert.equal(styles.scrollbar, 'none', `${label} 底部无横向滚动条`)
    assert.equal(styles.overscroll, 'none', `${label} 横向边缘取消回弹`)
    assert.ok(max > 0, `${label} 存在溢出标签`)

    const x = Math.round(bounds.x + bounds.width / 2)
    const y = Math.round(bounds.y + bounds.height / 2)
    if (mobile) {
      await swipe(page, x + 55, y, x - 55, y)
      await page.waitForFunction(element => element.scrollLeft > 0, { timeout: 4000 }, rail)
      await swipe(page, x - 110, y, x + 110, y)
      await page.waitForFunction(element => element.scrollLeft <= 1, { timeout: 4000 }, rail)
      // A vertical gesture starting on a TAB must still scroll the parent page.
      await swipe(page, x, y, x, y - 90)
      await page.waitForFunction(() => document.querySelector('.content-area').scrollTop > 0, { timeout: 4000 })
      await page.$eval('.content-area', area => { area.scrollTop = 0 })
    } else {
      await page.mouse.move(x, y)
      await page.mouse.wheel({ deltaY: max + 50 })
      await page.waitForFunction(element => element.scrollLeft >= element.scrollWidth - element.clientWidth - 1, { timeout: 4000 }, rail)
      await page.mouse.wheel({ deltaY: -max - 50 })
      await page.waitForFunction(element => element.scrollLeft <= 1, { timeout: 4000 }, rail)
    }

    const items = await rail.$$('[role=tab], .el-button')
    await rail.evaluate(element => { element.scrollLeft = element.scrollWidth })
    await items.at(-1).click()
    assert.ok(Math.abs(await scroll() - max) <= 1, `${label} 切换末项后 TAB 仍停在末端`)
    await rail.evaluate(element => { element.scrollLeft = 0 })
    await items[0].click()
    assert.ok(await scroll() <= 1, `${label} 切回首项后 TAB 仍停在起点`)

    if (!mobile && selector.endsWith('.el-tabs__nav-scroll')) {
      await items[0].focus()
      await page.keyboard.press('ArrowLeft')
      await page.waitForFunction(element => {
        const active = element.querySelector('[role=tab][aria-selected=true]')
        return active === element.querySelector('[role=tab]:last-child') &&
          active.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1
      }, { timeout: 4000 }, rail)
    }
  }

  await page.$eval('.content-area', area => { area.scrollTop = area.scrollHeight })
  const bottom = () => page.$eval('.content-area', area => ({
    top: area.scrollTop,
    max: area.scrollHeight - area.clientHeight,
    end: area.querySelector('[data-bottom]').getBoundingClientRect().bottom,
    root: document.documentElement.scrollTop
  }))
  const before = await bottom()
  assert.ok(before.top > 0 && Math.abs(before.top - before.max) <= 1 && before.end <= long.bottom, `${width} 内容末项完整可达`)
  if (mobile) {
    await swipe(page, width / 2, 740, width / 2, 440)
  } else {
    await page.mouse.move(width / 2, 740)
    await page.mouse.wheel({ deltaY: 800 })
  }
  await page.evaluate(() => new Promise(requestAnimationFrame))
  assert.deepEqual(await bottom(), before, `${width} 到底后继续滚动不移动文档或末项`)
}

async function checkPublicTabScrolling(page, width) {
  const mobile = width < 768
  await page.setViewport({ width, height: 820, isMobile: mobile, hasTouch: mobile })
  await page.evaluate(() => window.updateTopbar({ publicPage: true, longContent: true }))
  const tabAppearance = await page.$eval('.tf-page-tabs > .el-tabs__header', header => {
    const style = getComputedStyle(header)
    const selected = getComputedStyle(header.querySelector('.el-tabs__item.is-active'))
    return { background: style.backgroundColor, border: style.borderTopWidth, shadow: style.boxShadow, selected: selected.backgroundColor }
  })
  assert.equal(tabAppearance.background, 'rgba(0, 0, 0, 0)', `${width} 公开 TAB 外层透明`)
  assert.equal(tabAppearance.border, '0px', `${width} 公开 TAB 外层无边框`)
  assert.equal(tabAppearance.shadow, 'none', `${width} 公开 TAB 外层无阴影`)
  assert.notEqual(tabAppearance.selected, tabAppearance.background, `${width} 公开 TAB 保留选中底色`)
  const readScroll = () => page.evaluate(() => {
    const root = document.scrollingElement
    return {
      top: root.scrollTop,
      max: root.scrollHeight - root.clientHeight,
      overscroll: getComputedStyle(root).overscrollBehaviorY,
      bottom: document.querySelector('[data-bottom]').getBoundingClientRect().bottom
    }
  })
  assert.equal((await readScroll()).overscroll, 'none', `${width} 公开 TAB 页文档在边缘取消滚动回弹`)
  await page.evaluate(() => { window.scrollTo(0, document.scrollingElement.scrollHeight) })
  const before = await readScroll()
  assert.ok(before.top > 0 && Math.abs(before.top - before.max) <= 1 && before.bottom <= 820, `${width} 公开 TAB 页末项可达`)
  if (mobile) {
    await swipe(page, width / 2, 740, width / 2, 440)
  } else {
    await page.mouse.move(width / 2, 740)
    await page.mouse.wheel({ deltaY: 800 })
  }
  await page.evaluate(() => new Promise(requestAnimationFrame))
  assert.deepEqual(await readScroll(), before, `${width} 公开 TAB 页到底后继续滚动时末项稳定`)
}

let server, browser
try {
  server = await createServer({ root,configFile:false,envFile:false,logLevel:'error',cacheDir:join(temporary,'vite'),
    resolve:{ alias:{ '@':resolve(root,'src') } }, optimizeDeps:{ include:['vue','element-plus'] },
    plugins:[vue(),{ name:'isolated-topbar',enforce:'pre',
      resolveId:id=>id==='/__topbar.js'?'\0topbar-entry':undefined,
      async load(id) {
        if(id==='\0topbar-entry')return entry
        if(id!==shellFile&&id!==menuFile&&id!==tabsFile)return
        const source=await readFile(id,'utf8')
        const script=id===shellFile?shellScript:id===menuFile?menuScript:tabsScript
        const template=id===shellFile?source.replace(/<router-view\b[\s\S]*?<\/router-view>/,'<ScrollFixture />'):source
        return template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/,()=>'<script setup>'+script+'</script>')
      },
      configureServer(vite){vite.middlewares.use((req,res,next)=>{
        if(req.url==='/__topbar.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__topbar.js"></script></body></html>');return}
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
        const time=document.querySelector('.topbar-actions .last-login')
        return { topbar:box(topbar),card:box(card),avatarVisible:Boolean(document.querySelector('.topbar-actions .user-avatar')),timeFontSize:time?getComputedStyle(time).fontSize:null,timeFontWeight:time?getComputedStyle(time).fontWeight:null,buttons:buttons.map(button=>({ ...box(button),margin:parseFloat(getComputedStyle(button).marginLeft),icon:box(button.querySelector('.el-icon')),iconFontSize:getComputedStyle(button.querySelector('.el-icon')).fontSize,label:box(button.querySelector('.topbar-button-label')),labelVisible:button.querySelector('.topbar-button-label').getClientRects().length>0 })),
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
        assert.equal(button.iconFontSize,'16px',`${label} 顶部栏图标使用公共16px字号`)
        if(!compact)assert.ok(Math.abs(button.label.left-button.icon.right-4)<0.1,`${label} 图标与文字间距应为公共4px，实际 ${button.label.left-button.icon.right}`)
        assert.ok(Math.abs((button.icon.left+button.icon.right)/2-(button.left+button.right)/2)<1||!compact,`${label} 纯图标居中`)
        if(compact)assert.ok(Math.abs(button.width-button.height)<0.1,`${label} 纯图标按钮必须方形`)
        assert.ok(button.left>=0&&button.right<=width,`${label} 按钮完整可见`)
      }
      assert.ok(metrics.card.right<=lock.left&&metrics.card.width>0,`${label} 用户信息不遮挡按钮`)
      assert.equal(metrics.avatarVisible, false, `${label} 顶部栏不显示头像标志`)
      if(!compact){
        assert.equal(metrics.timeFontSize,'15px',`${label} 时间字号应为15px`)
        assert.equal(metrics.timeFontWeight,'700',`${label} 时间应使用粗体`)
      }
      assert.ok(metrics.scroll<=width,`${label} 页面不横向溢出`)
      if(compact)assert.ok(metrics.menu.right<=metrics.card.left,`${label} 菜单不遮挡用户卡片`)
      if(width===390&&theme==='light'&&name==='Boss'&&process.env.TOPBAR_SCREENSHOT)await page.screenshot({ path:process.env.TOPBAR_SCREENSHOT,clip:{ x:0,y:0,width,height:Math.ceil(metrics.topbar.height) } })
      await page.click('.btn-lock')
      assert.equal(await page.$eval('.btn-lock',element=>element.title),'解锁屏幕',`${label} 锁屏动作正常`)
      await page.click('.btn-lock')
      assert.equal(await page.$eval('.btn-lock',element=>element.title),'锁定屏幕',`${label} 解锁动作正常`)
      const before=await page.evaluate(()=>window.fixture.logout)
      assert.equal(await page.$eval('.logout-btn .topbar-button-label',element=>element.textContent.trim()),'退出',`${label} 退出按钮显示文案简洁`)
      await page.click('.logout-btn')
      assert.equal(await page.evaluate(()=>window.fixture.logout),before+1,`${label} 退出按钮点击可达`)
      cases++
    }
  }
  const tabWidths = [360, 390, 767, 768, 1024, 1025, 1440]
  for (const width of tabWidths) await checkTabScrolling(page, width)
  for (const width of [390, 1440]) await checkPublicTabScrolling(page, width)
  assert.deepEqual(errors,[])
  assert.deepEqual(blocked,[])
  console.log(`顶部栏浏览器回归通过：${cases}组；实际导航模板/样式、10个视口、明暗、长姓名及紧凑设备分支；无真实登录、锁屏或退出请求。`)
  console.log(`TAB 滚动浏览器回归通过：后台 ${tabWidths.length} 个视口、公开页 2 个视口；触摸、滚轮、键盘、首尾标签和底部边界。`)
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary,{ recursive:true,force:true })
}
