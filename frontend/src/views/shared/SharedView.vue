<template>
  <div class="shared-view admin-page safe-area-top safe-area-bottom">
    <PageHeader icon="fas fa-lightbulb" title="经验分享">
      <template #actions>
        <el-button v-if="canCreate" type="primary" @click="openCreate"><i class="fas fa-plus"></i>发布经验</el-button>
        <el-button v-if="canManage" @click="openCategoryManager"><i class="fas fa-tags"></i>分类管理</el-button>
        <el-button :loading="loading" @click="loadPosts"><i class="fas fa-refresh"></i>刷新</el-button>
      </template>
    </PageHeader>

    <div class="shared-content admin-page-content">
      <UnifiedSearchPanel v-model:expanded="searchExpanded" :loading="loading" @search="search" @reset="resetSearch">
        <template #primary>
          <el-input v-model="keyword" clearable placeholder="搜索标题或内容" @keyup.enter="search" @clear="search" @click.stop>
            <template #prefix><i class="fas fa-search"></i></template>
          </el-input>
        </template>
        <div class="filter-item">
          <el-select v-model="categoryFilter" clearable placeholder="全部分类" @change="search">
            <el-option v-for="item in categories" :key="item.name" :label="`${item.name} (${item.total})`" :value="item.name" />
          </el-select>
        </div>
        <div v-if="canManage" class="filter-item">
          <el-select v-model="visibilityFilter" placeholder="可见范围" @change="search">
            <el-option label="全部可见内容" value="" />
            <el-option label="公开分享" value="public" />
            <el-option label="我的私有" value="private" />
          </el-select>
        </div>
      </UnifiedSearchPanel>

      <div class="shared-feed" :class="{ 'is-loading': loading }">
        <div v-if="loading && posts.length === 0" class="shared-loading">正在加载经验分享...</div>
        <el-empty v-else-if="posts.length === 0" description="还没有经验分享">
          <el-button v-if="canCreate" type="primary" @click="openCreate">发布第一条经验</el-button>
        </el-empty>
        <article v-for="post in posts" v-else :key="post.id" class="shared-post" @click="openDetail(post.id)">
          <div class="post-accent"></div>
          <div class="post-main">
            <div class="post-heading">
              <div class="post-title-line">
                <span v-if="post.is_pinned" class="pin-badge"><i class="fas fa-thumbtack"></i>置顶</span>
                <span class="category-badge">{{ post.category }}</span>
                <span v-if="post.visibility === 'private'" class="private-badge"><i class="fas fa-lock"></i>私有</span>
                <h2>{{ post.title }}</h2>
              </div>
              <div class="post-actions action-buttons" @click.stop>
                <el-button v-if="canEditPost(post)" class="table-action table-action--edit" size="small" title="编辑" @click="openEdit(post.id)"><i class="fas fa-edit"></i>编辑</el-button>
                <el-button v-if="canDeletePost(post)" class="table-action table-action--delete" size="small" title="删除" @click="removePost(post)"><i class="fas fa-trash"></i>删除</el-button>
                <el-button v-if="canPinPost(post)" class="table-action table-action--pin" size="small" title="置顶" @click="togglePin(post)"><i class="fas fa-thumbtack"></i>{{ post.is_pinned ? '取消置顶' : '置顶' }}</el-button>
              </div>
            </div>
            <p class="post-excerpt">{{ excerpt(post.content) }}</p>
            <div v-if="post.attachments.length" class="post-attachment-summary">
              <span v-if="attachmentCount(post, 'image')"><i class="fas fa-image"></i>{{ attachmentCount(post, 'image') }} 张图片</span>
              <span v-if="attachmentCount(post, 'video')"><i class="fas fa-video"></i>{{ attachmentCount(post, 'video') }} 个视频</span>
              <span v-if="attachmentCount(post, 'audio')"><i class="fas fa-music"></i>{{ attachmentCount(post, 'audio') }} 个音频</span>
              <span v-if="attachmentCount(post, 'file')"><i class="fas fa-paperclip"></i>{{ attachmentCount(post, 'file') }} 个文件</span>
            </div>
            <div class="post-meta">
              <span class="author-avatar">{{ authorInitial(post) }}</span>
              <strong>{{ post.author.name }}</strong>
              <span>{{ formatDateTime(post.created_at) }}</span>
              <span v-if="post.updated_at !== post.created_at">已更新</span>
            </div>
          </div>
          <i class="fas fa-chevron-right post-open-icon"></i>
        </article>
      </div>

      <Pagination v-model:current="pagination.page" v-model:page-size="pagination.limit" :total="pagination.total" :page-sizes="[12, 24, 48]" :disabled="loading" @change="pageChanged" />
    </div>

    <el-dialog v-model="editorVisible" :title="editingId ? '编辑经验分享' : '发布经验分享'" width="1080px" class="shared-editor-dialog" :close-on-click-modal="false" @opened="handleEditorDialogOpened" @closed="cleanupUnsavedInlineUploads">
      <el-form ref="formRef" class="tf-dialog-form tf-dialog-form--stacked" :model="form" :rules="rules" label-position="top">
        <el-form-item label="标题" prop="title"><el-input v-model="form.title" maxlength="200" show-word-limit placeholder="清楚描述遇到的问题或经验主题" /></el-form-item>
        <div class="shared-meta-fields" :class="{ 'shared-meta-fields--single': !canChooseVisibility }">
          <el-form-item label="分类" prop="category">
            <el-select v-model="form.category" filterable placeholder="选择分类">
              <el-option v-for="name in categoryOptions" :key="name" :label="name" :value="name" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="canChooseVisibility" label="可见范围" prop="visibility">
            <el-radio-group v-model="form.visibility" class="visibility-control">
              <el-radio-button value="public"><i class="fas fa-globe"></i>公开</el-radio-button>
              <el-radio-button value="private"><i class="fas fa-lock"></i>私有</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item class="content-form-item" label="内容" prop="content">
          <div class="rich-editor" :class="{ 'is-initializing': !editorReady }" @pointerdown="requestEditorFocus">
            <WangToolbar :editor="editorInstance" :default-config="toolbarConfig" mode="default" />
            <WangEditor v-model="form.content" :default-config="editorConfig" mode="default" @on-created="handleEditorCreated" />
            <div v-if="!editorReady" class="rich-editor-loading">编辑器加载中...</div>
            <div class="rich-editor-filebar">
              <input ref="fileInputRef" type="file" :accept="acceptedDocuments" hidden @change="uploadInlineDocument" />
              <el-button text :loading="uploadingFile" @click="fileInputRef?.click()"><i class="fas fa-paperclip"></i>插入文件</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions"><el-button @click="editorVisible=false">取消</el-button><el-button type="primary" :loading="saving" @click="savePost">保存发布</el-button></div>
      </template>
    </el-dialog>

    <el-dialog v-model="categoryManagerVisible" title="分享分类管理" width="640px" class="category-manager-dialog" :close-on-click-modal="false">
      <div class="category-create-row">
        <el-input v-model="newCategoryName" maxlength="60" clearable placeholder="输入新分类名称" @keyup.enter="createCategory" />
        <el-button type="primary" :loading="categorySaving" @click="createCategory"><i class="fas fa-plus"></i>新增</el-button>
      </div>
      <el-table :data="categories" class="category-table" table-layout="auto" empty-text="暂无分类">
        <el-table-column label="分类名称" min-width="120">
          <template #default="{ row }">
            <el-input v-if="editingCategoryId === row.id" v-model="editingCategoryName" maxlength="60" @keyup.enter="saveCategory(row)" />
            <span v-else class="category-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="内容" align="center" width="72" />
        <el-table-column label="操作" align="center" min-width="112">
          <template #default="{ row }">
            <div class="category-row-actions action-buttons">
              <template v-if="editingCategoryId === row.id">
                <el-button type="primary" text :loading="categorySaving" @click="saveCategory(row)">保存</el-button>
                <el-button text @click="cancelCategoryEdit">取消</el-button>
              </template>
              <template v-else>
                <el-button class="table-action table-action--edit" :disabled="row.name === '未分类'" @click="startCategoryEdit(row)">编辑</el-button>
                <el-button class="table-action table-action--delete" :disabled="row.name === '未分类'" @click="deleteCategory(row)">删除</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer><div class="tf-dialog-actions"><el-button @click="categoryManagerVisible=false">关闭</el-button></div></template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="经验分享详情" width="920px" class="shared-detail-dialog">
      <div v-if="detail" class="shared-detail">
        <div class="detail-heading">
          <div class="detail-labels">
            <span v-if="detail.is_pinned" class="pin-badge"><i class="fas fa-thumbtack"></i>置顶</span>
            <span class="category-badge">{{ detail.category }}</span>
            <span v-if="detail.visibility === 'private'" class="private-badge"><i class="fas fa-lock"></i>仅自己可见</span>
            <span v-else class="public-badge"><i class="fas fa-globe"></i>公开</span>
          </div>
          <h2>{{ detail.title }}</h2>
          <div class="detail-author"><span class="author-avatar">{{ authorInitial(detail) }}</span><div><strong>{{ detail.author.name }}</strong><small>发布于 {{ formatDateTime(detail.created_at) }}</small></div></div>
        </div>
        <div class="detail-content" v-html="renderRichText(detail.content)" @click="handleRichContentClick"></div>
        <div v-if="detachedAttachments(detail).length" class="detail-attachments">
          <template v-for="file in detachedAttachments(detail)" :key="file.url">
            <a v-if="isImage(file)" class="media-image" :href="fileUrl(file.url)" @click.prevent="openImagePreview(fileUrl(file.url), detachedAttachments(detail).filter(isImage).map(item => fileUrl(item.url)))"><img :src="fileUrl(file.url)" :alt="file.name" /></a>
            <video v-else-if="isVideo(file)" class="media-video" controls preload="metadata"><source :src="fileUrl(file.url)" :type="file.type" /></video>
            <audio v-else-if="isAudio(file)" class="media-audio" controls preload="metadata"><source :src="fileUrl(file.url)" :type="file.type" /></audio>
            <a v-else class="document-file" :href="fileUrl(file.url)" target="_blank" download><i :class="attachmentIcon(file)"></i><span><strong>{{ file.name }}</strong><small>{{ formatSize(file.size) }}</small></span><i class="fas fa-download"></i></a>
          </template>
        </div>
      </div>
      <template v-if="detail" #footer>
        <div class="tf-dialog-actions"><el-button @click="detailVisible=false">关闭</el-button><el-button v-if="canEditPost(detail)" type="primary" @click="openEdit(detail.id)">编辑</el-button></div>
      </template>
    </el-dialog>
    <el-image-viewer v-if="imagePreviewVisible" :url-list="imagePreviewUrls" :initial-index="imagePreviewIndex" :hide-on-click-modal="true" teleported :z-index="12000" @close="imagePreviewVisible=false" />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, shallowRef, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElImageViewer, ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import DOMPurify from 'dompurify'
import { Editor as WangEditor, Toolbar as WangToolbar } from '@wangeditor/editor-for-vue'
import 'element-plus/theme-chalk/el-image-viewer.css'
import '@wangeditor/editor/dist/css/style.css'
import { PageHeader } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { usePagePermissions } from '@/composables/usePagePermissions'

interface SharedAttachment { url:string; name:string; type:string; size:number }
interface SharedAuthor { id:number; name:string; username:string }
type SharedVisibility = 'public' | 'private'
interface SharedPost { id:number; title:string; content:string; category:string; visibility:SharedVisibility; attachments:SharedAttachment[]; is_pinned:boolean; author_id:number; author:SharedAuthor; created_at:string; updated_at:string }
interface SharedCategory { id:number; name:string; sort_order:number; total:number }

const authStore = useAuthStore()
const { canCreate, canEdit, canDelete, canManage } = usePagePermissions('shared')
const loading = ref(false), saving = ref(false), editorVisible = ref(false), detailVisible = ref(false)
const searchExpanded = ref(false)
const posts = ref<SharedPost[]>([]), detail = ref<SharedPost|null>(null), editingId = ref<number|null>(null), keyword = ref('')
const categories = ref<SharedCategory[]>([])
const categoryFilter = ref('')
const visibilityFilter = ref('')
const categoryManagerVisible = ref(false)
const categorySaving = ref(false)
const newCategoryName = ref('')
const editingCategoryId = ref<number|null>(null)
const editingCategoryName = ref('')
const editingAuthorId = ref<number|null>(null)
const formRef = ref<FormInstance>()
const editorInstance = shallowRef<any>()
const editorReady = ref(false)
const editorFocusPending = ref(false)
const inlineUploaded = ref<SharedAttachment[]>([])
const originalInlineUrls = ref<Set<string>>(new Set())
const fileInputRef = ref<HTMLInputElement>()
const uploadingFile = ref(false)
const imagePreviewVisible = ref(false)
const imagePreviewUrls = ref<string[]>([])
const imagePreviewIndex = ref(0)
const pagination = reactive({ page:1, limit:12, total:0 })
const form = reactive<{title:string;content:string;category:string;visibility:SharedVisibility;attachments:SharedAttachment[]}>({ title:'', content:'', category:'未分类', visibility:'public', attachments:[] })
const rules:FormRules = { title:[{required:true,message:'请输入经验标题',trigger:'blur'}], category:[{required:true,message:'请选择或输入分类',trigger:'change'}], content:[{required:true,message:'请输入内容',trigger:'blur'}] }
const acceptedDocuments = '.pdf,.ofd,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.wps,.et,.dps,.txt,.md,.rtf,.log,.json,.xml,.zip,.rar,.7z,.tar,.gz,.tgz,.bz2,.epub,.mp3,.wav,.m4a,.aac,.flac'

const currentUserId = computed(() => Number((authStore.user as any)?.id || 0))
const canChooseVisibility = computed(() => canManage.value && (editingId.value === null || editingAuthorId.value === currentUserId.value))
const isOwnPost = (post:SharedPost) => Number(post.author_id) === currentUserId.value
const canEditPost = (post:SharedPost) => canManage.value || (canEdit.value && isOwnPost(post))
const canDeletePost = (post:SharedPost) => canManage.value || (canDelete.value && isOwnPost(post))
const canPinPost = (post:SharedPost) => canManage.value && post.visibility === 'public'
const categoryOptions = computed(() => categories.value.map(item => item.name))
const isImage = (file:SharedAttachment) => file.type.startsWith('image/')
const isVideo = (file:SharedAttachment) => file.type.startsWith('video/')
const isAudio = (file:SharedAttachment) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac)$/i.test(file.name)
const attachmentKind = (file:SharedAttachment) => isImage(file) ? 'image' : isVideo(file) ? 'video' : isAudio(file) ? 'audio' : 'file'
const attachmentCount = (post:SharedPost, kind:string) => post.attachments.filter(file => attachmentKind(file) === kind).length
const detachedAttachments = (post:SharedPost) => post.attachments.filter(file => !post.content.includes(file.url))
const attachmentIcon = (file:SharedAttachment) => isImage(file) ? 'fas fa-image' : isVideo(file) ? 'fas fa-video' : isAudio(file) ? 'fas fa-music' : file.type.includes('pdf') ? 'fas fa-file-pdf' : file.type.includes('sheet') || file.name.match(/\.xlsx?$/i) ? 'fas fa-file-excel' : file.type.includes('word') || file.name.match(/\.docx?$/i) ? 'fas fa-file-word' : 'fas fa-file'
const authorInitial = (post:SharedPost) => (post.author?.name || post.author?.username || '用').trim().slice(0, 1)
const richTextToPlain = (content:string) => { const container = document.createElement('div'); container.innerHTML = content || ''; return (container.textContent || '').replace(/\s+/g, ' ').trim() }
const hasRichContent = (content:string) => Boolean(richTextToPlain(content) || /<(img|video|audio|table)\b/i.test(content || ''))
const excerpt = (content:string) => { const plain=richTextToPlain(content); if(!plain)return /<(img|video)\b/i.test(content || '') ? '图片或视频内容' : '富文本内容'; return plain.length>96 ? `${plain.slice(0,96)}...` : plain }
const safeRichText = (content:string) => DOMPurify.sanitize(content || '', { USE_PROFILES: { html: true } })
const protectRichTextUrls = (content:string) => {
  const container=document.createElement('div')
  container.innerHTML=safeRichText(content)
  container.querySelectorAll('[src],a[href]').forEach(element=>{
    const attribute=element.hasAttribute('src')?'src':'href'
    const value=element.getAttribute(attribute)||''
    if(value.startsWith('/uploads/shared/'))element.setAttribute(attribute,fileUrl(value))
  })
  return container.innerHTML
}
const renderRichText = (content:string) => {
  const container=document.createElement('div')
  container.innerHTML=protectRichTextUrls(content)
  container.querySelectorAll('a[href]').forEach(link=>{const href=link.getAttribute('href')||'';if(!/\.(mp3|wav|m4a|aac|flac)(?:[?#].*)?$/i.test(href))return;const wrapper=document.createElement('div');wrapper.className='inline-audio-player';const label=document.createElement('strong');label.textContent=(link.textContent||'音频').replace(/^文件[：:]\s*/,'');const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=href;wrapper.append(label,audio);link.replaceWith(wrapper)})
  return container.innerHTML
}
const formatSize = (bytes:number) => { if(!bytes)return '0 B'; const units=['B','KB','MB','GB']; const index=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1); return `${(bytes/Math.pow(1024,index)).toFixed(index?1:0)} ${units[index]}` }
const formatDateTime = (value:string) => value ? new Date(String(value).replace(' ','T')).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '-'
const fileUrl = (url:string) => {
  if (!url.startsWith('/uploads/shared/')) return url.startsWith('http') ? url : url.startsWith('/') ? url : `/${url}`
  const filename=url.split('/').pop()||''
  const token=String((authStore as any).token||'')
  return `/api/shared/files/${encodeURIComponent(filename)}${token?`?token=${encodeURIComponent(token)}`:''}`
}
const normalizeRichTextForStorage = (content:string) => {
  const container=document.createElement('div')
  container.innerHTML=content
  container.querySelectorAll('[src],a[href]').forEach(element=>{
    const attribute=element.hasAttribute('src')?'src':'href'
    const value=element.getAttribute(attribute)||''
    const match=value.match(/\/api\/shared\/files\/([^?#/]+)/)
    if(match)element.setAttribute(attribute,`/uploads/shared/${decodeURIComponent(match[1])}`)
  })
  return container.innerHTML
}
const openImagePreview = (selected:string, urls:string[]) => { imagePreviewUrls.value=urls;imagePreviewIndex.value=Math.max(0,urls.indexOf(selected));imagePreviewVisible.value=urls.length>0 }
const handleRichContentClick = (event:MouseEvent) => { const target=event.target as HTMLElement;if(target.tagName!=='IMG')return;event.preventDefault();const container=event.currentTarget as HTMLElement;const urls=Array.from(container.querySelectorAll('img')).map(image=>image.src).filter(Boolean);openImagePreview((target as HTMLImageElement).src,urls) }

const loadPosts = async () => { loading.value=true; try{ const response:any=await api.get('/shared',{params:{page:pagination.page,limit:pagination.limit,keyword:keyword.value||undefined,category:categoryFilter.value||undefined,visibility:visibilityFilter.value||undefined}}); if(response.success){posts.value=Array.isArray(response.data)?response.data:[];pagination.total=Number(response.pagination?.total||0)} }catch{ElMessage.error('加载经验分享失败')}finally{loading.value=false} }
const loadCategories = async () => { try{const response:any=await api.get('/shared/categories');categories.value=response.success&&Array.isArray(response.data)?response.data:[]}catch{categories.value=[]} }
const openCategoryManager = async () => { cancelCategoryEdit();newCategoryName.value='';categoryManagerVisible.value=true;await loadCategories() }
const createCategory = async () => {
  const name = newCategoryName.value.trim()
  if (!name) { ElMessage.warning('请输入分类名称'); return }
  categorySaving.value = true
  try {
    const response:any = await api.post('/shared/categories', { name })
    if (response.success) { ElMessage.success('分类已新增');newCategoryName.value='';await loadCategories() }
  } catch (error:any) { ElMessage.error(error?.response?.data?.message || error?.message || '新增分类失败') }
  finally { categorySaving.value=false }
}
const startCategoryEdit = (category:SharedCategory) => { editingCategoryId.value=category.id;editingCategoryName.value=category.name }
const cancelCategoryEdit = () => { editingCategoryId.value=null;editingCategoryName.value='' }
const saveCategory = async (category:SharedCategory) => {
  const name = editingCategoryName.value.trim()
  if (!name) { ElMessage.warning('请输入分类名称'); return }
  categorySaving.value=true
  try {
    const response:any=await api.put(`/shared/categories/${category.id}`,{name})
    if(response.success){ElMessage.success('分类已更新');if(categoryFilter.value===category.name)categoryFilter.value=name;if(form.category===category.name)form.category=name;cancelCategoryEdit();await Promise.all([loadCategories(),loadPosts()])}
  } catch(error:any){ElMessage.error(error?.response?.data?.message||error?.message||'更新分类失败')}
  finally{categorySaving.value=false}
}
const deleteCategory = async (category:SharedCategory) => {
  try {
    await ElMessageBox.confirm(`确定删除分类“${category.name}”吗？该分类下的内容将归入“未分类”。`,'删除分类',{type:'warning'})
    const response:any=await api.delete(`/shared/categories/${category.id}`)
    if(response.success){ElMessage.success('分类已删除');if(categoryFilter.value===category.name)categoryFilter.value='';if(form.category===category.name)form.category='未分类';await Promise.all([loadCategories(),loadPosts()])}
  } catch(error:any){if(error!=='cancel'&&error!=='close')ElMessage.error(error?.response?.data?.message||error?.message||'删除分类失败')}
}
const search = () => { pagination.page=1;loadPosts() }
const resetSearch = () => { keyword.value='';categoryFilter.value='';visibilityFilter.value='';pagination.page=1;loadPosts() }
const pageChanged = (page:number,size:number) => { pagination.page=page;pagination.limit=size;loadPosts() }
const uploadInlineMedia = async (file:File, insert:(url:string, alt?:string, href?:string)=>void, isVideo = false) => {
  if (file.size > 100 * 1024 * 1024) { ElMessage.error(`${file.name} 超过100MB`); return }
  if (form.attachments.length + inlineUploaded.value.length >= 10) { ElMessage.error('正文图片和视频最多上传10个'); return }
  const data = new FormData(); data.append('files', file)
  const response:any = await api.upload('/shared/upload', data)
  if (!response.success || !Array.isArray(response.data) || !response.data[0]) throw new Error(response.message || '媒体上传失败')
  const uploaded = response.data[0] as SharedAttachment
  inlineUploaded.value.push(uploaded)
  const url = fileUrl(uploaded.url)
  if (isVideo) insert(url, '')
  else insert(url, uploaded.name, url)
}
const toolbarConfig:any = {}
const editorConfig:any = { placeholder: '记录问题现象、原因、解决过程和注意事项', maxLength: 100000, MENU_CONF: {
  uploadImage: { customUpload: (file:File, insert:(url:string, alt?:string, href?:string)=>void) => uploadInlineMedia(file, insert) },
  uploadVideo: { customUpload: (file:File, insert:(url:string, poster?:string)=>void) => uploadInlineMedia(file, insert, true) }
} }
const focusEditor = () => { if(!editorInstance.value)return; editorInstance.value.focus(false); editorFocusPending.value=false }
const requestEditorFocus = () => { if(!editorReady.value)editorFocusPending.value=true }
const handleEditorDialogOpened = () => { if(editorFocusPending.value&&editorReady.value)nextTick(focusEditor) }
const handleEditorCreated = (editor:any) => { editorInstance.value=editor; nextTick(()=>{ editorReady.value=true; if(editorFocusPending.value)focusEditor() }) }
const escapeHtml = (value:string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] || char))
const uploadInlineDocument = async (event:Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 100 * 1024 * 1024) { ElMessage.error(`${file.name} 超过100MB`); return }
  if (form.attachments.length + inlineUploaded.value.length >= 10) { ElMessage.error('正文媒体和文件最多上传10个'); return }
  uploadingFile.value = true
  try {
    const data = new FormData(); data.append('files', file)
    const response:any = await api.upload('/shared/upload', data)
    if (!response.success || !Array.isArray(response.data) || !response.data[0]) throw new Error(response.message || '文件上传失败')
    const uploaded = response.data[0] as SharedAttachment
    inlineUploaded.value.push(uploaded)
    const url = fileUrl(uploaded.url)
    editorInstance.value?.focus()
    if (isAudio(uploaded)) editorInstance.value?.dangerouslyInsertHtml(`<p><a href="${url}" target="_blank">音频：${escapeHtml(uploaded.name)}</a></p>`)
    else editorInstance.value?.dangerouslyInsertHtml(`<p><a href="${url}" target="_blank">文件：${escapeHtml(uploaded.name)}（${formatSize(uploaded.size)}）</a></p>`)
  } catch (error:any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '文件上传失败')
  } finally {
    uploadingFile.value = false
  }
}
const cleanupUnsavedInlineUploads = () => {
  const urls = inlineUploaded.value.map(file => file.url)
  inlineUploaded.value = []
  if (urls.length) api.post('/shared/uploads/cleanup', { urls }).catch(() => undefined)
}
const resetForm = () => { editingId.value=null;editingAuthorId.value=null;form.title='';form.content='';form.category=categoryOptions.value.includes('未分类')?'未分类':(categoryOptions.value[0]||'');form.visibility='public';form.attachments=[];inlineUploaded.value=[];originalInlineUrls.value=new Set();formRef.value?.clearValidate() }
const openCreate = () => { resetForm();editorVisible.value=true }
const fetchPost = async (id:number) => { const response:any=await api.get(`/shared/${id}`); return response.success ? response.data as SharedPost : null }
const openDetail = async (id:number) => { const post=await fetchPost(id);if(post){detail.value=post;detailVisible.value=true} }
const openEdit = async (id:number) => { const post=await fetchPost(id);if(!post)return;editingId.value=id;editingAuthorId.value=Number(post.author_id);form.title=post.title;form.content=protectRichTextUrls(post.content);form.category=post.category||'未分类';form.visibility=post.visibility||'public';form.attachments=[...post.attachments];inlineUploaded.value=[];originalInlineUrls.value=new Set(post.attachments.filter(file=>post.content.includes(file.url)).map(file=>file.url));detailVisible.value=false;editorVisible.value=true }
const savePost = async () => { if(!formRef.value)return;await formRef.value.validate();if(!hasRichContent(form.content)){ElMessage.error('请输入内容');return}const storageContent=normalizeRichTextForStorage(safeRichText(form.content));saving.value=true;try{const retainedExisting=form.attachments.filter(file=>!originalInlineUrls.value.has(file.url)||storageContent.includes(file.url));const retainedInline=inlineUploaded.value.filter(file=>storageContent.includes(file.url));const removedInline=inlineUploaded.value.filter(file=>!storageContent.includes(file.url));const payload={...form,content:storageContent,visibility:canChooseVisibility.value?form.visibility:'public',category:form.category.trim(),attachments:[...retainedExisting,...retainedInline]};const response:any=editingId.value?await api.put(`/shared/${editingId.value}`,payload):await api.post('/shared',payload);if(removedInline.length)await api.post('/shared/uploads/cleanup',{urls:removedInline.map(file=>file.url)});if(response.success){ElMessage.success(editingId.value?'经验分享已更新':'经验分享已发布');editorVisible.value=false;await Promise.all([loadPosts(),loadCategories()])}}catch(error:any){if(inlineUploaded.value.length)api.post('/shared/uploads/cleanup',{urls:inlineUploaded.value.map(file=>file.url)}).catch(()=>undefined);ElMessage.error(error?.response?.data?.message||error?.message||'保存失败')}finally{saving.value=false} }
const togglePin = async (post:SharedPost) => { const response:any=await api.patch(`/shared/${post.id}/pin`,{pinned:!post.is_pinned});if(response.success){ElMessage.success(post.is_pinned?'已取消置顶':'已置顶');loadPosts()} }
const removePost = async (post:SharedPost) => { try{await ElMessageBox.confirm(`确定删除“${post.title}”吗？附件也会一并删除。`,'删除确认',{type:'warning'});const response:any=await api.delete(`/shared/${post.id}`);if(response.success){ElMessage.success('经验分享已删除');if(detail.value?.id===post.id)detailVisible.value=false;loadPosts()}}catch(error){if(error!=='cancel'&&error!=='close')ElMessage.error('删除失败')} }

onMounted(() => { void Promise.all([loadPosts(), loadCategories()]) })
onBeforeUnmount(() => { editorInstance.value?.destroy() })
</script>

<style scoped lang="scss">
.shared-view{min-height:100%}.shared-content{display:flex;flex-direction:column;gap:14px}.shared-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:var(--admin-search-panel-padding-y) var(--admin-search-panel-padding-x)}.shared-feed{display:grid;gap:10px;opacity:1;transition:opacity .2s}.shared-feed.is-loading{opacity:.65}.shared-loading{padding:48px;text-align:center;color:#64748b}.shared-post{position:relative;display:grid;grid-template-columns:4px minmax(0,1fr) 24px;gap:14px;align-items:center;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;overflow:hidden;transition:border-color .18s,box-shadow .18s}.shared-post:hover{border-color:var(--admin-interactive-hover-border,#94a3b8);box-shadow:var(--admin-interactive-hover-shadow,0 5px 16px rgba(15,23,42,.08))}.post-accent{align-self:stretch;background:#14b8a6;border-radius:4px}.post-heading{display:flex;justify-content:space-between;gap:12px}.post-title-line{display:flex;align-items:center;gap:8px;min-width:0}.post-title-line h2{margin:0;color:#172033;font-size:17px;line-height:1.4;letter-spacing:0;overflow-wrap:anywhere}.pin-badge{display:inline-flex;align-items:center;gap:5px;flex:none;padding:3px 7px;border-radius:4px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;font-size:12px;font-weight:700}.post-actions{display:flex;flex:none}.post-excerpt{margin:8px 0;color:#475569;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.post-attachment-summary,.post-meta{display:flex;align-items:center;flex-wrap:wrap;gap:12px;color:#64748b;font-size:12px}.post-attachment-summary{margin-bottom:10px}.post-attachment-summary span{display:inline-flex;align-items:center;gap:5px}.post-meta{gap:8px}.author-avatar{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#e0f2fe;color:#0369a1;font-weight:800}.post-meta strong{color:#334155}.post-open-icon{color:#94a3b8}.rich-editor,.attachment-editor{width:100%;min-width:0}.rich-editor{overflow:hidden;border:1px solid #dcdfe6;border-radius:6px;background:#fff;transition:border-color .18s,box-shadow .18s}.rich-editor:focus-within{border-color:#409eff;box-shadow:0 0 0 1px #409eff inset}.rich-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:3px;padding:6px;border-bottom:1px solid #e5e7eb;background:#f8fafc}.rich-toolbar button{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid transparent;border-radius:4px;background:transparent;color:#334155;font-size:14px;cursor:pointer}.rich-toolbar button:hover{border-color:#cbd5e1;background:#fff;color:#0f766e}.rich-editor-input{min-height:260px;max-height:50vh;padding:12px 14px;overflow:auto;color:#1f2937;line-height:1.7;outline:0;overflow-wrap:anywhere}.rich-editor-input:empty::before{color:#a8abb2;content:attr(data-placeholder);pointer-events:none}.rich-editor-input :deep(h3){margin:16px 0 8px;font-size:18px;line-height:1.5}.rich-editor-input :deep(p){margin:8px 0}.rich-editor-input :deep(blockquote){margin:10px 0;padding:8px 12px;border-left:3px solid #14b8a6;background:#f0fdfa;color:#475569}.rich-editor-input :deep(ul),.rich-editor-input :deep(ol){padding-left:24px}.rich-editor-meta{padding:5px 10px;border-top:1px solid #eef2f7;background:#fafafa;color:#8492a6;font-size:12px}.upload-tip{display:block;margin-top:7px;color:#64748b}.existing-attachments{display:grid;gap:6px;margin-top:10px}.existing-attachment{display:grid;grid-template-columns:20px minmax(0,1fr) auto 28px;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px}.existing-attachment span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.existing-attachment small{color:#64748b}.existing-attachment button{width:28px;height:28px;border:0;background:transparent;color:#ef4444;cursor:pointer}.detail-heading{padding-bottom:16px;border-bottom:1px solid #e2e8f0}.detail-heading h2{margin:10px 0 14px;font-size:24px;color:#172033;letter-spacing:0;overflow-wrap:anywhere}.detail-author{display:flex;align-items:center;gap:10px}.detail-author div{display:flex;flex-direction:column}.detail-author small{margin-top:3px;color:#64748b}.detail-content{padding:20px 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#334155;line-height:1.8}.detail-content :deep(h2),.detail-content :deep(h3),.detail-content :deep(h4){margin:20px 0 8px;color:#172033;line-height:1.45}.detail-content :deep(p){margin:8px 0}.detail-content :deep(ul),.detail-content :deep(ol){margin:10px 0;padding-left:26px}.detail-content :deep(blockquote){margin:14px 0;padding:10px 14px;border-left:4px solid #14b8a6;background:#f0fdfa;color:#475569}.detail-content :deep(a){color:#047857;text-decoration:underline}.detail-content :deep(pre){max-width:100%;padding:12px;overflow:auto;border-radius:6px;background:#172033;color:#f8fafc}.detail-attachments{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.media-image{display:block;aspect-ratio:4/3;overflow:hidden;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc}.media-image img{width:100%;height:100%;object-fit:contain}.media-video{grid-column:1/-1;width:100%;max-height:480px;background:#111827;border-radius:6px}.document-file{display:grid;grid-template-columns:28px minmax(0,1fr) 20px;align-items:center;gap:10px;padding:12px;color:#334155;text-decoration:none;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc}.document-file>i:first-child{font-size:22px;color:#0f766e}.document-file span{display:flex;min-width:0;flex-direction:column}.document-file strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.document-file small{margin-top:3px;color:#64748b}
.rich-editor :deep(.w-e-toolbar){flex-wrap:wrap;border-bottom:1px solid #dcdfe6}.rich-editor :deep(.w-e-text-container){min-height:280px}.rich-editor :deep(.w-e-text){min-height:260px;max-height:50vh;overflow-y:auto}.rich-editor :deep(.w-e-text-placeholder){color:#a8abb2}
.rich-editor{position:relative}.rich-editor-loading{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.9);color:#64748b;font-size:13px;cursor:progress}
.shared-meta-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.shared-meta-fields--single{grid-template-columns:minmax(0,1fr)}.shared-meta-fields :deep(.el-form-item){min-width:0}.shared-meta-fields :deep(.el-select),.visibility-control{width:100%}.visibility-control{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.visibility-control :deep(.el-radio-button){min-width:0}.visibility-control :deep(.el-radio-button__inner){display:flex;width:100%;align-items:center;justify-content:center;gap:6px}.category-badge,.private-badge,.public-badge{display:inline-flex;flex:none;align-items:center;gap:5px;padding:3px 7px;border:1px solid;border-radius:4px;font-size:12px;font-weight:700;line-height:1.3}.category-badge{border-color:#a5f3fc;background:#ecfeff;color:#0e7490}.private-badge{border-color:#fecdd3;background:#fff1f2;color:#be123c}.public-badge{border-color:#bbf7d0;background:#f0fdf4;color:#15803d}.detail-labels{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px}.category-create-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin-bottom:12px}.category-create-row :deep(.el-button){min-width:80px;margin:0}.category-table{width:100%}.category-name{color:#334155;font-weight:600}.category-row-actions{white-space:nowrap}.category-manager-dialog :deep(.el-dialog__body){overflow-x:hidden}
.shared-feed{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch}.shared-loading,.shared-feed>.el-empty{grid-column:1/-1}.shared-post{grid-template-columns:3px minmax(0,1fr);gap:12px;min-width:0;min-height:188px;height:100%;padding:14px}.shared-post>.post-open-icon{display:none}.post-main{display:flex;min-width:0;height:100%;flex-direction:column}.post-heading{min-width:0;align-items:flex-start}.post-title-line{min-width:0;flex:1}.post-title-line h2{display:-webkit-box;min-width:0;overflow:hidden;text-overflow:ellipsis;-webkit-box-orient:vertical;-webkit-line-clamp:1}.post-actions{max-width:100%;flex-wrap:wrap;justify-content:flex-end;gap:5px}.post-actions :deep(.el-button i){margin-right:4px}.post-excerpt{display:-webkit-box;min-height:42px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}.post-attachment-summary{min-height:18px;margin-bottom:8px;overflow:hidden;white-space:nowrap}.post-attachment-summary span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.post-meta{margin-top:auto;min-width:0;flex-wrap:nowrap;overflow:hidden;white-space:nowrap}.post-meta strong,.post-meta>span:not(.author-avatar){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:1200px) and (min-width:769px){.shared-feed{grid-template-columns:repeat(2,minmax(0,1fr))}}
.rich-editor-filebar{display:flex;align-items:center;justify-content:flex-start;padding:5px 8px;border-top:1px solid #e5e7eb;background:#f8fafc}.rich-editor-filebar :deep(.el-button){min-width:0;margin:0;padding:6px 8px}.rich-editor-filebar i{margin-right:6px}
.detail-content :deep(img){display:block;max-width:100%;height:auto;margin:12px auto;border-radius:6px;cursor:zoom-in}.detail-content :deep(video){display:block;width:100%;max-height:560px;margin:12px 0;border-radius:6px;background:#111827}.detail-content :deep(audio),.media-audio{display:block;width:min(100%,560px);margin:10px 0}.detail-content :deep(.inline-audio-player){display:flex;flex-direction:column;gap:8px;margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc}.detail-content :deep(.inline-audio-player strong){color:#334155;font-size:13px}.detail-content :deep(.inline-audio-player audio){width:100%;margin:0}
.shared-detail-dialog :deep(.el-dialog__body){max-width:100%;overflow-x:hidden}.shared-detail{display:flex;width:100%;max-width:100%;min-width:0;flex-direction:column;gap:12px;overflow:hidden}.detail-heading{box-sizing:border-box;width:100%;max-width:100%;padding:16px 18px;border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff}.detail-heading h2{text-align:center}.detail-author{flex-wrap:wrap}.detail-author div{display:flex;min-width:0;flex-direction:row;align-items:center;flex-wrap:wrap;gap:8px}.detail-author small{margin-top:0}.detail-content{box-sizing:border-box;width:100%;max-width:100%;min-width:0;padding:18px;border:1px solid #dbe4ee;border-radius:6px;background:#f8fafc;overflow-x:auto;-webkit-overflow-scrolling:touch}.detail-content :deep(table){width:100%!important;max-width:100%;margin:14px 0;border:1px solid #cbd5e1;border-collapse:collapse;border-spacing:0;table-layout:auto;background:#fff;color:#334155}.detail-content :deep(th),.detail-content :deep(td){min-width:0;padding:9px 12px;border:1px solid #cbd5e1;text-align:left;vertical-align:top;white-space:normal;word-break:break-word;overflow-wrap:anywhere}.detail-content :deep(th){background:#eaf0f6;color:#1f2937;font-weight:700}.detail-content :deep(tbody tr:nth-child(even) td){background:#f8fafc}.detail-content :deep(td p),.detail-content :deep(th p){margin:0}.detail-content :deep(caption){padding:8px;color:#475569;font-weight:600;text-align:left}.detail-content :deep(img),.detail-content :deep(video),.detail-content :deep(audio),.detail-content :deep(pre),.detail-content :deep(iframe){box-sizing:border-box;max-width:100%}
@media(max-width:768px){.shared-search{grid-template-columns:minmax(0,1fr) auto}.shared-meta-fields{grid-template-columns:minmax(0,1fr)}.shared-post{grid-template-columns:3px minmax(0,1fr);gap:10px;padding:12px}.post-open-icon{display:none}.post-heading{align-items:flex-start}.post-actions{flex-wrap:wrap;justify-content:flex-end}.post-title-line{align-items:flex-start;flex-direction:column}.post-title-line h2{font-size:15px}.post-excerpt{font-size:13px}.shared-editor-dialog :deep(.el-dialog),.shared-detail-dialog :deep(.el-dialog),.category-manager-dialog :deep(.el-dialog){width:calc(100vw - 8px)!important;margin:4px auto}.shared-editor-dialog :deep(.el-dialog__footer),.shared-detail-dialog :deep(.el-dialog__footer),.category-manager-dialog :deep(.el-dialog__footer){display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important}.category-create-row{grid-template-columns:minmax(0,1fr) 72px}.category-create-row :deep(.el-button){width:72px;min-width:0;padding-inline:8px}.category-table :deep(.el-table__cell){padding:7px 0}.category-row-actions{gap:0}.rich-editor :deep(.w-e-text-container){min-height:220px}.rich-editor :deep(.w-e-text){min-height:200px}.detail-heading h2{font-size:19px}.detail-attachments{grid-template-columns:1fr}.media-video{grid-column:auto}}
@media(max-width:768px){.shared-feed{grid-template-columns:1fr}.shared-post{min-height:168px}.shared-detail{gap:8px}.detail-heading,.detail-content{padding:12px}.detail-content :deep(th),.detail-content :deep(td){min-width:88px;padding:8px 10px}}
</style>
