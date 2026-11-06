<template>
  <main class="guide-public">
    <section class="guide-shell">
      <header class="guide-brand">
        <div class="guide-brand__mark">
          <i class="fas fa-compass" />
        </div>
        <div class="guide-brand__text">
          <p class="guide-brand__eyebrow">
            {{ settings.site_eyebrow || 'DH NAVIGATION' }}
          </p>
          <h1>{{ settings.site_title || '导航中心' }}</h1>
        </div>
      </header>

      <section
        v-if="announcements.length"
        class="guide-notices"
        aria-label="公告"
      >
        <div class="guide-notices__cards">
          <article
            v-if="pinnedAnnouncement"
            class="guide-notice-card guide-notice-card--pinned"
          >
            <div class="guide-notice-card__label">
              <i class="fas fa-thumbtack" />置顶公告
            </div>
            <div class="guide-notice">
              <a
                v-if="pinnedAnnouncement.link_url"
                :href="pinnedAnnouncement.link_url"
                target="_blank"
                rel="noopener noreferrer"
              ><strong>{{ pinnedAnnouncement.title }}</strong></a>
              <strong v-else>{{ pinnedAnnouncement.title }}</strong>
              <RichContent
                v-if="pinnedAnnouncement.content"
                class="guide-notice__content"
                :content="pinnedAnnouncement.content"
              />
            </div>
          </article>
          <article
            v-if="scrollingAnnouncements.length"
            class="guide-notice-card guide-notice-card--rotation"
          >
            <div class="guide-notice-card__label">
              <i class="fas fa-bullhorn" />公告
            </div>
            <div
              v-if="currentScrollingAnnouncement"
              :key="currentScrollingAnnouncement.id"
              class="guide-notice"
            >
              <a
                v-if="currentScrollingAnnouncement.link_url"
                :href="currentScrollingAnnouncement.link_url"
                target="_blank"
                rel="noopener noreferrer"
              ><strong>{{ currentScrollingAnnouncement.title }}</strong></a>
              <strong v-else>{{ currentScrollingAnnouncement.title }}</strong>
              <RichContent
                v-if="currentScrollingAnnouncement.content"
                class="guide-notice__content"
                :content="currentScrollingAnnouncement.content"
              />
            </div>
          </article>
        </div>
      </section>

      <section
        v-if="categories.length"
        class="guide-categories"
      >
        <article
          v-for="category in categories"
          :key="category.id"
          class="guide-category"
        >
          <div class="guide-category__header">
            <div class="guide-category__icon">
              <i :class="category.icon || 'fas fa-layer-group'" />
            </div>
            <div class="guide-category__heading">
              <h2>{{ category.name }}</h2>
              <p v-if="category.description">
                {{ category.description }}
              </p>
            </div>
            <div
              v-if="!category.locked && category.children?.length"
              class="guide-category__tabs"
            >
              <el-tabs
                v-model="activeCategoryTabs[category.id]"
                class="tf-page-tabs tf-page-tabs--compact"
              >
                <el-tab-pane
                  v-for="item in publicCategoryTabs(category)"
                  :key="item.id"
                  :label="item.name"
                  :name="categoryTabName(item)"
                  class="tf-tab-panel"
                />
              </el-tabs>
            </div>
            <el-button
              v-if="publicActiveTarget(category).locked"
              text
              class="guide-icon-button tf-button--view"
              title="解锁分类"
              aria-label="解锁分类"
              @click="openUnlock(publicActiveTarget(category))"
            >
              <i class="fas fa-lock" />
            </el-button>
          </div>

          <div
            v-if="!publicActiveTarget(category).locked && publicActiveTarget(category).links.length"
            class="guide-category__content"
          >
            <div class="guide-links">
              <a
                v-for="link in publicActiveTarget(category).links"
                :key="link.id"
                :href="link.link_type === 'url' ? link.url || undefined : undefined"
                :target="link.link_type === 'url' ? '_blank' : undefined"
                :download="link.link_type === 'file' && !isImageFile(link.file_mime) ? link.file_name || link.title : undefined"
                rel="noreferrer"
                class="guide-link"
                @click="handleLinkClick($event, link)"
              >
                <span class="guide-link__body"><strong>{{ link.title }}</strong><small v-if="link.description">{{ link.description }}</small></span>
              </a>
            </div>
          </div>
          <div
            v-else-if="publicActiveTarget(category).locked"
            class="guide-category__empty"
          >
            仅会员可见
          </div>
          <div
            v-else
            class="guide-category__empty"
          >
            暂无导航
          </div>
        </article>
      </section>

      <div
        v-else
        class="guide-empty"
      >
        <i class="fas fa-compass" />
        <strong>暂无导航内容</strong>
        <span>请稍后再来查看</span>
      </div>

      <footer class="guide-footer">
        {{ settings.footer_text || 'DH Navigation' }}
      </footer>
    </section>

    <div
      v-if="hasCustomerService"
      class="guide-floating-service"
    >
      <el-button
        class="tf-button--service-float"
        aria-label="联系客服"
        title="联系客服"
        @click="serviceVisible = true"
      >
        <i class="fas fa-headset" />
      </el-button>
      <span class="guide-floating-service__label">客服</span>
    </div>

    <MobileDialog
      v-model="serviceVisible"
      title="联系客服"
      width="320px"
      :show-close="true"
      :show-default-footer="false"
    >
      <div class="guide-service">
        <div
          v-if="settings.contact_phone && settings.contact_wechat"
          class="guide-service__row"
        >
          <el-button
            tag="a"
            class="tf-button--service-card"
            :href="`tel:${settings.contact_phone}`"
          >
            <span class="guide-service__icon guide-service__icon--phone"><i class="fas fa-phone" /></span>
            <span class="guide-service__content"><span>拨打</span><strong>{{ settings.contact_phone }}</strong></span>
          </el-button>
          <el-button
            native-type="button"
            class="tf-button--service-card"
            @click="addWechat"
          >
            <span class="guide-service__icon guide-service__icon--wechat"><i class="fab fa-weixin" /></span>
            <span class="guide-service__content"><span>加微信</span><strong>{{ settings.contact_wechat }}</strong></span>
          </el-button>
        </div>
        <el-button
          v-else-if="settings.contact_phone"
          tag="a"
          class="tf-button--service-card"
          :href="`tel:${settings.contact_phone}`"
        >
          <span class="guide-service__icon guide-service__icon--phone"><i class="fas fa-phone" /></span>
          <span class="guide-service__content"><span>客服电话</span><strong>{{ settings.contact_phone }}</strong></span>
        </el-button>
        <el-button
          v-else-if="settings.contact_wechat"
          native-type="button"
          class="tf-button--service-card"
          @click="addWechat"
        >
          <span class="guide-service__icon guide-service__icon--wechat"><i class="fab fa-weixin" /></span>
          <span class="guide-service__content"><span>微信号</span><strong>{{ settings.contact_wechat }}</strong></span>
        </el-button>
      </div>
    </MobileDialog>

    <MobileDialog
      v-model="unlockVisible"
      title="访问受限分类"
      width="420px"
      :show-default-footer="false"
    >
      <form
        class="guide-dialog-form"
        @submit.prevent="submitUnlock"
      >
        <p class="guide-dialog-form__hint">
          请输入“{{ selectedCategory?.name }}”的访问密码
        </p>
        <el-input
          v-model="password"
          type="password"
          show-password
          placeholder="访问密码"
          autocomplete="off"
          @keyup.enter="submitUnlock"
        />
        <div class="guide-dialog-form__actions">
          <el-button @click="unlockVisible = false">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="unlocking"
            native-type="submit"
          >
            确认访问
          </el-button>
        </div>
      </form>
    </MobileDialog>

    <MobileDialog
      v-model="filePreviewVisible"
      title="图片预览"
      width="420px"
      :show-default-footer="false"
    >
      <div class="guide-qr-preview">
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          :alt="previewFile?.title || '图片预览'"
        >
      </div>
    </MobileDialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import MobileDialog from '@/components/MobileDialog.vue'
import { guideApi } from '@/api/guide'
import RichContent from '@/components/RichContent.vue'
import { extractBlobResponse, unifiedApi } from '@/utils/unified-api'
import { getRequestErrorMessage } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import type { GuideAnnouncement, GuideCategory, GuideLink, GuideSettings, GuideUnlockResponse } from '@/types/guide'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


const announcements = ref<GuideAnnouncement[]>([])
const categories = ref<GuideCategory[]>([])
const settings = ref<GuideSettings>({ site_title: '导航中心', site_eyebrow: 'DH NAVIGATION', footer_text: 'DH Navigation', contact_wechat: null, contact_phone: null })
const serviceVisible = ref(false)
const unlockVisible = ref(false)
const unlocking = ref(false)
const password = ref('')
const selectedCategory = ref<GuideCategory | null>(null)
const filePreviewVisible = ref(false)
const previewFile = ref<GuideLink | null>(null)
const previewImageUrl = ref('')
const activeCategoryTabs = reactive<Record<number, string>>({})
const announcementIndex = ref(0)
const ANNOUNCEMENT_ROTATION_MS = 4000
let announcementTimer: ReturnType<typeof setInterval> | null = null

const pinnedAnnouncement = computed(() => announcements.value.find(item => item.is_pinned) || null)
const scrollingAnnouncements = computed(() => announcements.value.filter(item => !item.is_pinned))
const currentScrollingAnnouncement = computed(() => scrollingAnnouncements.value[announcementIndex.value] || null)
const categoryTabName = (category: GuideCategory) => `category-${category.id}`
const publicCategoryTabs = (category: GuideCategory) => category.links.length
  ? [category, ...(category.children || [])]
  : category.children || []
const publicActiveTarget = (category: GuideCategory) => {
  if (category.locked) return category
  const tabs = publicCategoryTabs(category)
  return tabs.find(item => categoryTabName(item) === activeCategoryTabs[category.id]) || tabs[0] || category
}
const syncCategoryTabs = () => {
  categories.value.forEach(category => {
    activeCategoryTabs[category.id] = categoryTabName(publicActiveTarget(category))
  })
}
const isImageFile = (mime: string | null | undefined) => String(mime || '').toLowerCase().startsWith('image/')
const hasCustomerService = computed(() => Boolean(settings.value.contact_phone || settings.value.contact_wechat))

const stopAnnouncementRotation = () => {
  if (announcementTimer) {
    clearInterval(announcementTimer)
    announcementTimer = null
  }
}

const startAnnouncementRotation = () => {
  stopAnnouncementRotation()
  announcementIndex.value = 0
  if (scrollingAnnouncements.value.length <= 1) return
  announcementTimer = setInterval(() => {
    const nextIndex = (announcementIndex.value + 1) % scrollingAnnouncements.value.length
    announcementIndex.value = nextIndex
  }, ANNOUNCEMENT_ROTATION_MS)
}

const loadGuide = async () => {
  const response = await guideApi.public()
  announcements.value = response.data?.announcements || []
  settings.value = response.data?.settings || settings.value
  categories.value = response.data?.categories || []
  syncCategoryTabs()
}

const addWechat = async () => {
  const wechat = settings.value.contact_wechat
  if (!wechat) return
  try {
    await navigator.clipboard.writeText(wechat)
    globalNotifications.success('微信号已复制，正在打开微信...')
    window.setTimeout(() => {
      window.location.href = `weixin://dl/chat?${encodeURIComponent(wechat)}`
    }, 1000)
  } catch (error) {
    logger.warn('复制客服微信失败:', error)
    globalNotifications.info(`请添加客服微信：${wechat}`)
  }
}

watch(scrollingAnnouncements, () => { startAnnouncementRotation() }, { deep: true })

const openUnlock = (category: GuideCategory) => {
  selectedCategory.value = category
  password.value = ''
  unlockVisible.value = true
}

const submitUnlock = async () => {
  if (!selectedCategory.value || !password.value.trim()) {
    globalNotifications.warning('请输入访问密码')
    return
  }
  unlocking.value = true
  try {
    const response = await guideApi.unlock(selectedCategory.value.id, password.value)
    const accessToken = response.data?.access_token
    const unlockedResponse = accessToken
      ? await guideApi.category(selectedCategory.value.id, accessToken)
      : response
    const unlocked = accessToken
      ? unlockedResponse.data as GuideCategory | undefined
      : (unlockedResponse.data as GuideUnlockResponse | undefined)?.category
    if (unlocked) replaceCategory(unlocked)
    unlockVisible.value = false
    globalNotifications.success('分类已解锁')
  } catch (error) {
    globalNotifications.error(getRequestErrorMessage(error, '分类解锁失败'))
  } finally {
    unlocking.value = false
  }
}

const replaceCategory = (updated: GuideCategory) => {
  const replaceIn = (items: GuideCategory[]): boolean => {
    const index = items.findIndex(item => item.id === updated.id)
    if (index >= 0) {
      items[index] = updated
      return true
    }
    return items.some(item => replaceIn(item.children || []))
  }
  replaceIn(categories.value)
  syncCategoryTabs()
}

const openImagePreview = async (link: GuideLink) => {
  if (!link.file_url) return
  if (previewImageUrl.value) URL.revokeObjectURL(previewImageUrl.value)
  if (!link.file_signature || !link.file_expires_at) {
    previewImageUrl.value = link.file_url
    previewFile.value = link
    filePreviewVisible.value = true
    return
  }
  try {
    const response = await unifiedApi.getInstance().get<Blob>(link.file_url.replace(/^\/api(?=\/)/, ''), {
      responseType: 'blob',
      headers: {
        'X-Guide-File-Expires': String(link.file_expires_at),
        'X-Guide-File-Signature': link.file_signature
      }
    })
    previewImageUrl.value = URL.createObjectURL(extractBlobResponse(response))
    previewFile.value = link
    filePreviewVisible.value = true
  } catch (error) {
    globalNotifications.error(getRequestErrorMessage(error, '图片加载失败，请刷新页面后重试'))
  }
}

const downloadGuideFile = (link: GuideLink) => {
  if (!link.file_url) return
  const downloadPath = link.file_url.replace(/^\/api(?=\/)/, '')
  const headers = link.file_signature && link.file_expires_at
    ? { 'X-Guide-File-Expires': String(link.file_expires_at), 'X-Guide-File-Signature': link.file_signature }
    : undefined
  void unifiedApi.download(downloadPath, link.file_name || link.title, headers ? { headers } : undefined)
    .catch(error => globalNotifications.error(getRequestErrorMessage(error, '文件下载失败，请稍后重试')))
}

const handleLinkClick = (event: MouseEvent, link: GuideLink) => {
  if (link.link_type !== 'file') return
  event.preventDefault()
  if (isImageFile(link.file_mime)) {
    void openImagePreview(link)
    return
  }
  downloadGuideFile(link)
}

onMounted(() => {
  loadGuide().catch(() => globalNotifications.error('导航数据加载失败'))
})

onBeforeUnmount(() => {
  stopAnnouncementRotation()
  if (previewImageUrl.value) URL.revokeObjectURL(previewImageUrl.value)
})
</script>

<style scoped>
.guide-public { min-height: 100vh; background: var(--tf-color-slate-50); color: var(--tf-color-slate-800); }
.guide-shell { width: min(100% - var(--tf-space-7), 760px); margin: 0 auto; padding: var(--tf-space-6) 0 var(--tf-space-7); }
.guide-brand { display: flex; align-items: center; gap: var(--tf-space-3); margin-bottom: var(--tf-space-6); }
.guide-brand__text { min-width: 0; overflow-wrap: anywhere; }
.guide-brand__mark { display: grid; flex-shrink: 0; width: 44px; height: 44px; place-items: center; border-radius: var(--tf-radius-panel); background: var(--tf-color-indigo-600); color: var(--tf-color-white); font-size: var(--tf-type-scale-20); }
.guide-brand__eyebrow { margin: 0 0 var(--tf-space-1); color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-11); font-weight: 700; }
.guide-brand h1 { margin: 0; color: var(--tf-color-slate-900); font-size: var(--tf-type-scale-24); line-height: 1.2; }
.guide-notices { display: grid; gap: var(--tf-space-2); }
.guide-notices__title { display: flex; align-items: center; gap: var(--tf-space-2); color: var(--tf-color-amber-700); font-weight: 700; }
.guide-notices__cards { display: grid; gap: var(--tf-space-2); }
.guide-notice-card { min-width: 0; padding: var(--tf-space-2); border: 1px solid var(--tf-color-amber-200); border-radius: var(--tf-radius-panel); background: var(--tf-color-amber-50); }
.guide-notice-card__label { display: flex; align-items: center; gap: var(--tf-space-2); padding: 0 var(--tf-space-2); color: var(--tf-color-amber-700); font-size: var(--tf-type-scale-13); font-weight: 700; }
.guide-notice { display: grid; min-width: 0; justify-items: center; gap: var(--tf-space-1); padding: var(--tf-space-2) var(--tf-space-3); color: var(--tf-color-slate-700); text-align: center; text-decoration: none; overflow-wrap: anywhere; }
.guide-notice strong { color: var(--tf-color-slate-900); font-size: var(--tf-type-scale-15); text-align: center; }
.guide-notice__content { width: 100%; text-align: left; }
.guide-categories { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--tf-space-4); margin-top: var(--tf-space-5); }
.guide-category { min-width: 0; padding: var(--tf-space-4); border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-panel); background: var(--tf-color-white); box-shadow: var(--tf-shadow-card); }
.guide-category__header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tf-space-2); min-width: 0; }
.guide-category__icon { display: grid; flex: none; width: 30px; height: 30px; place-items: center; border-radius: var(--tf-radius-card); background: var(--tf-color-indigo-50); color: var(--tf-color-indigo-600); font-size: var(--tf-type-scale-16); }
.guide-category__heading { min-width: 0; flex: 0 1 auto; }
.guide-category__heading h2 { margin: 0; color: var(--tf-color-slate-900); font-size: var(--tf-type-scale-15); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.guide-category__heading p { margin: var(--tf-space-1) 0 0; color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-12); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.guide-category__tabs {
  --admin-panel-gap: var(--tf-space-1);
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
}
.guide-icon-button, .guide-text-button { border: 0; background: transparent; color: var(--tf-color-indigo-600); cursor: pointer; }
.guide-icon-button { display: grid; flex: none; width: 34px; height: 34px; place-items: center; border-radius: var(--tf-radius-card); font-size: var(--tf-type-scale-15); }
.guide-icon-button:hover, .guide-text-button:hover { background: var(--tf-color-indigo-50); }
.guide-links { display: flex; flex-wrap: wrap; align-content: flex-start; align-items: flex-start; gap: var(--tf-space-2); max-height: calc(6 * (var(--tf-button-height) + var(--tf-space-2))); margin-top: var(--tf-space-4); overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: none; }
.guide-links::-webkit-scrollbar { display: none; }
.guide-category__content { display: grid; gap: var(--tf-space-4); }
.guide-link { display: inline-flex; align-items: center; flex: 0 1 auto; width: fit-content; max-width: min(100%, 220px); min-width: 0; min-height: var(--tf-button-height-small); box-sizing: border-box; padding: var(--tf-space-1) var(--tf-space-2); border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-control); color: inherit; text-decoration: none; transition: border-color var(--tf-motion-fast) var(--tf-motion-ease-standard), background-color var(--tf-motion-fast) var(--tf-motion-ease-standard); }
.guide-link:hover { border-color: var(--tf-color-indigo-300); background: var(--tf-color-indigo-50); }
.guide-link__body { display: grid; width: fit-content; min-width: 0; max-width: 100%; gap: var(--tf-space-1); line-height: 1.25; }
.guide-link__body strong, .guide-link__body small { overflow-wrap: anywhere; }
.guide-link__body strong { color: var(--tf-color-slate-800); font-size: var(--tf-type-scale-13); }
.guide-link__body small { color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-12); }
.guide-category__empty { margin-top: var(--tf-space-4); color: var(--tf-color-slate-400); font-size: var(--tf-type-scale-13); text-align: center; }
.guide-empty { display: grid; min-height: 300px; place-content: center; justify-items: center; gap: var(--tf-space-2); color: var(--tf-color-slate-500); text-align: center; }
.guide-empty i { color: var(--tf-color-indigo-400); font-size: var(--tf-font-display-lg); }
.guide-footer { padding-top: var(--tf-space-6); color: var(--tf-color-slate-400); font-size: var(--tf-type-scale-12); text-align: center; overflow-wrap: anywhere; }
.guide-floating-service { position: fixed; right: var(--tf-service-float-right); bottom: var(--tf-service-float-bottom); z-index: var(--tf-z-viewer); display: flex; width: var(--tf-service-float-size); min-width: var(--tf-service-float-size); max-width: var(--tf-service-float-size); flex-direction: column; align-items: center; gap: 0; background: transparent; }
.guide-floating-service i { color: var(--tf-button-on-color); font-size: var(--tf-service-float-icon-size); line-height: 1; }
.guide-floating-service__label { display: inline-flex; width: auto; max-width: 100%; align-self: center; padding: var(--tf-space-1) var(--tf-space-2); background: transparent; color: var(--tf-color-green-600); font-size: var(--tf-type-scale-12); font-weight: 500; line-height: 1.2; white-space: nowrap; }
.guide-service { display: grid; gap: var(--tf-space-3); }
.guide-service__row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: var(--tf-space-3); }
.guide-service__icon { display: grid; flex: none; width: var(--tf-button-height-large); height: var(--tf-button-height-large); place-items: center; border-radius: var(--tf-radius-full); color: var(--tf-button-on-color); font-size: var(--tf-type-scale-20); }
.guide-service__icon--phone { background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%); }
.guide-service__icon--wechat { background: linear-gradient(135deg, var(--tf-color-accent-green) 0%, var(--tf-color-green-accent) 100%); }
.guide-service__icon i { color: inherit; }
.guide-service__content { display: grid; min-width: 0; max-width: 100%; gap: var(--tf-space-1); text-align: center; }
.guide-service__content span { color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-12); }
.guide-service__content strong { max-width: 100%; color: var(--tf-color-slate-800); font-size: var(--tf-type-scale-14); font-weight: 500; overflow-wrap: anywhere; }
.guide-dialog-form { display: grid; gap: var(--tf-space-4); }
.guide-dialog-form__hint { margin: 0; color: var(--tf-color-slate-600); line-height: 1.6; overflow-wrap: anywhere; }
.guide-dialog-form__actions { display: flex; justify-content: flex-end; gap: var(--tf-space-2); }
.guide-qr-preview { display: grid; min-height: 280px; place-items: center; }
.guide-qr-preview img { width: min(100%, 320px); max-height: 60vh; object-fit: contain; }
@media (max-width: 479px) {
  .guide-shell { width: min(100% - var(--tf-space-5), 760px); padding-top: var(--tf-space-4); }
  .guide-notice-card { padding: var(--tf-space-2) var(--tf-space-1); }
  .guide-link { padding-inline: var(--tf-space-2); }
  .guide-category { padding: var(--tf-space-3); }
}
@media (max-width: 375px) {
  .guide-shell { width: calc(100% - var(--tf-space-4)); }
  .guide-category__header { align-items: flex-start; }
  .guide-category__heading { max-width: calc(100% - 38px); }
  .guide-category__tabs { flex-basis: 100%; }
  .guide-link { max-width: 100%; }
}
</style>
