import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const files = {
  adminShell: join(root, 'src/views/system/page/SimpleAdminView.vue'),
  tabs: join(root, 'src/components/TabsBar.vue'),
  responsiveLayout: join(root, 'src/components/ResponsiveLayout.vue'),
  responsiveMenu: join(root, 'src/components/ResponsiveMenu.vue'),
  sidebar: join(root, 'src/components/SimpleSidebar.vue'),
  mobileMenu: join(root, 'src/components/mobile/MobileSlideMenu.vue'),
  buttonStyles: join(root, 'src/styles/components/_buttons.scss')
}
const sources = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(file, 'utf8')]))
const findings = []

const requireText = (key, text, message) => {
  if (!sources[key].includes(text)) findings.push(`${key}: ${message}`)
}

const forbid = (key, pattern, message) => {
  if (pattern.test(sources[key])) findings.push(`${key}: ${message}`)
}

requireText('adminShell', 'background: var(--tf-nav-topbar-bg)', '顶部栏必须使用白色顶部栏令牌')
requireText('adminShell', 'color: var(--tf-nav-topbar-text)', '面包屑文字必须使用顶部栏对比色')
requireText('tabs', 'background: var(--tf-nav-topbar-bg)', '标签页必须使用白色顶部栏令牌')
requireText('sidebar', 'background: var(--tf-nav-header-bg)', '侧边栏必须使用统一导航背景令牌')
requireText('sidebar', 'background: var(--tf-nav-submenu-bg)', '侧边栏二级菜单必须使用统一子菜单背景令牌')
requireText('mobileMenu', 'background: var(--tf-nav-submenu-bg)', '侧滑菜单二级菜单必须使用统一子菜单背景令牌')
requireText('mobileMenu', 'const configuredWidth = Number(menuWidth.value) || 160', '手机菜单宽度必须读取后台菜单宽度配置')
requireText('mobileMenu', 'width: 100%; /* 实际宽度由 useMenuWidth', '手机菜单不得保留固定 CSS 宽度')
requireText('mobileMenu', 'height: var(--tf-nav-menu-item-height)', '手机一级菜单必须使用统一行高')
requireText('mobileMenu', 'font-size: var(--tf-nav-menu-arrow-size)', '手机菜单箭头必须使用公共箭头尺寸')
requireText('sidebar', 'font-size: var(--tf-nav-menu-arrow-size)', 'PC 菜单箭头必须使用公共箭头尺寸')
requireText('sidebar', 'font-size: var(--tf-nav-menu-text-size)', 'PC 一级菜单文字必须使用公共字号')
requireText('mobileMenu', 'font-size: var(--tf-nav-menu-text-size)', '手机一级菜单文字必须使用公共字号')
requireText('mobileMenu', 'font-size: var(--tf-nav-submenu-text-size)', '手机二级菜单文字必须使用公共字号')
requireText('adminShell', 'background: var(--tf-nav-topbar-bg)', '顶部栏必须使用白色背景令牌')
requireText('responsiveMenu', 'class="mobile-menu-button tf-button--menu"', '手机端菜单入口必须使用统一按钮语义')
requireText('responsiveMenu', '<IconRenderer :svg="menuBarsIcon" aria-hidden="true" />', '手机端菜单入口必须使用公共三条杠 SVG 图标')
requireText('responsiveMenu', '@/assets/icons/menu-bars.svg?raw', '菜单图标必须使用本地资源，不依赖外部图标服务')
requireText('responsiveLayout', 'class="menu-button tf-button--menu"', '兼容布局菜单入口必须使用统一紫色菜单按钮语义')
requireText('responsiveLayout', '<IconRenderer :svg="menuBarsIcon" aria-hidden="true" />', '兼容布局菜单入口必须使用公共三条杠 SVG 图标')
requireText('responsiveLayout', 'showBreadcrumb && (isMobile || isTablet)', '面包屑仅允许在手机端和 iPad/平板端展示')
requireText('buttonStyles', 'body .el-button.el-button.tf-button--menu {\n  @include tf-filled-button(\n    var(--tf-color-indigo-brand), var(--tf-color-indigo-brand), var(--color-bg-white),\n    var(--tf-color-purple-brand), var(--tf-color-purple-brand)', '顶部菜单入口必须复用公共实心按钮实现，使用品牌靛蓝背景、白色图标和紫色悬停态')
requireText('buttonStyles', 'color: var(--color-bg-white) !important', '顶部菜单入口图标必须使用白色对比色')

forbid('adminShell', /\.topbar\s*\{[^}]*background:\s*(?:white|#fff(?:fff)?)(?:\s|;)/i, '顶部栏不得硬编码白色背景')
forbid('adminShell', /sidebar-toggle-btn|tf-button--menu/, 'PC 主布局不得渲染手机端菜单入口按钮')
forbid('tabs', /\.tab-item(?:\.active)?\s*\{[^}]*background:\s*white\b/i, '标签页不得硬编码白色背景')
forbid('sidebar', /\.mobile-grid \.mobile-item\s*\{[^}]*background:\s*(?:white|var\([^)]*color-bg-white)/i, '移动菜单项不得使用白色背景兜底')
requireText('buttonStyles', 'background: transparent !important', '二级菜单展开按钮必须使用透明导航背景')
forbid('buttonStyles', /\.tf-button--menu-action\s*\{[^}]*background:\s*var\(--tf-button-neutral-bg\)/i, '二级菜单展开按钮不得回退为白色中性按钮')
forbid('mobileMenu', /width:\s*280px/i, '手机菜单不得写死 280px 宽度')

if (findings.length) {
  console.error(`导航视觉审计失败，共 ${findings.length} 处：`)
  findings.forEach(finding => console.error(`- ${finding}`))
  process.exit(1)
}

console.log('导航视觉审计通过：顶部栏、面包屑、桌面/移动菜单及二级菜单均接入统一导航令牌。')
