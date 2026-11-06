<template>
  <div
    class="tf-rich-editor"
    :class="{ 'is-ready': ready }"
  >
    <Toolbar
      :editor="editor"
      :default-config="toolbarConfig"
      mode="default"
    />
    <div class="tf-rich-editor__tools">
      <slot name="tools" />
    </div>
    <Editor
      v-model="content"
      :default-config="editorConfig"
      mode="default"
      @on-created="handleCreated"
    />
    <div
      v-if="!ready"
      class="tf-rich-editor__loading"
    >
      <InlineLoading text="编辑器加载中..." />
    </div>
    <slot
      name="append"
      :editor="editor"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import InlineLoading from '@/components/InlineLoading.vue'
import { useNotification } from '@/composables/useNotification'
import { getRequestErrorMessage } from '@/utils/api-response'
import { wangEditorModulePromise } from '@/utils/rich-text-editor-loader'

export interface RichTextMediaResult {
  url: string
  alt?: string
  href?: string
}

interface Props {
  modelValue: string
  placeholder?: string
  maxLength?: number
  uploadMedia: (file: File, kind: 'image' | 'video') => Promise<RichTextMediaResult>
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入内容',
  maxLength: 100000
})
const emit = defineEmits<{ 'update:modelValue': [value: string]; ready: [editor: IDomEditor] }>()
const Editor = defineAsyncComponent(() => wangEditorModulePromise.then(module => module.Editor))
const Toolbar = defineAsyncComponent(() => wangEditorModulePromise.then(module => module.Toolbar))
const editor = shallowRef<IDomEditor | null>(null)
const ready = ref(false)
const { error: notifyError } = useNotification()
const content = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})
const toolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    'headerSelect',
    {
      key: 'group-more-style',
      title: '更多格式',
      iconSvg: '<svg viewBox="0 0 1024 1024"><path d="M204.8 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path><path d="M505.6 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path><path d="M806.4 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path></svg>',
      menuKeys: [
        'through', 'code', 'sup', 'sub', 'clearStyle', 'color', 'bgColor',
        'fontSize', 'fontFamily', 'lineHeight', 'blockquote', 'indent', 'delIndent',
        'emotion', 'insertTable', 'codeBlock', 'divider'
      ]
    },
    'bold',
    'underline',
    'italic',
    '|',
    'bulletedList',
    'numberedList',
    'todo',
    {
      key: 'group-justify',
      title: '对齐方式',
      iconSvg: '<svg viewBox="0 0 1024 1024"><path d="M768 793.6v102.4H51.2v-102.4h716.8z m204.8-230.4v102.4H51.2v-102.4h921.6z m-204.8-230.4v102.4H51.2v-102.4h716.8zM972.8 102.4v102.4H51.2V102.4h921.6z"></path></svg>',
      menuKeys: ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyJustify']
    },
    '|',
    'insertLink',
    {
      key: 'group-image',
      title: '图片',
      iconSvg: '<svg viewBox="0 0 1024 1024"><path d="M959.877 128l0.123 0.123v767.775l-0.123 0.122H64.102l-0.122-0.122V128.123l0.122-0.123h895.775zM960 64H64C28.795 64 0 92.795 0 128v768c0 35.205 28.795 64 64 64h896c35.205 0 64-28.795 64-64V128c0-35.205-28.795-64-64-64zM832 288.01c0 53.023-42.988 96.01-96.01 96.01s-96.01-42.987-96.01-96.01S682.967 192 735.99 192 832 234.988 832 288.01zM896 832H128V704l224.01-384 256 320h64l224.01-192z"></path></svg>',
      menuKeys: ['insertImage', 'uploadImage']
    },
    {
      key: 'group-video',
      title: '视频',
      iconSvg: '<svg viewBox="0 0 1024 1024"><path d="M981.184 160.096C837.568 139.456 678.848 128 512 128S186.432 139.456 42.816 160.096C15.296 267.808 0 386.848 0 512s15.264 244.16 42.816 351.904C186.464 884.544 345.152 896 512 896s325.568-11.456 469.184-32.096C1008.704 756.192 1024 637.152 1024 512s-15.264-244.16-42.816-351.904zM384 704V320l320 192-320 192z"></path></svg>',
      menuKeys: ['insertVideo', 'uploadVideo']
    },
    '|',
    'undo',
    'redo',
    'fullScreen'
  ]
}
const upload = async (
  file: File,
  insert: (url: string, alt?: string, href?: string) => void,
  kind: 'image' | 'video'
) => {
  try {
    const result = await props.uploadMedia(file, kind)
    insert(result.url, result.alt, result.href)
  } catch (uploadError) {
    notifyError(getRequestErrorMessage(uploadError, '媒体上传失败'))
  }
}
const editorConfig = computed<Partial<IEditorConfig>>(() => ({
  placeholder: props.placeholder,
  maxLength: props.maxLength,
  MENU_CONF: {
    fontSize: { fontSizeList: ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'] },
    uploadImage: {
      customUpload: (file: File, insert: (url: string, alt?: string, href?: string) => void) => upload(file, insert, 'image')
    },
    uploadVideo: {
      customUpload: (file: File, insert: (url: string, poster?: string) => void) => upload(file, insert, 'video')
    }
  }
}))
const handleCreated = (instance: IDomEditor) => {
  editor.value = instance
  ready.value = true
  emit('ready', instance)
}

onBeforeUnmount(() => {
  editor.value?.destroy()
  editor.value = null
})
</script>

<style scoped>
.tf-rich-editor {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: visible;
  border: 1px solid var(--color-border);
  border-radius: var(--tf-radius-control);
  background: var(--color-bg-white);
}
.tf-rich-editor :deep(.w-e-toolbar) {
  display: flex;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--tf-color-neutral-200);
  border-radius: var(--tf-radius-control) var(--tf-radius-control) 0 0;
  background: var(--tf-color-slate-50);
}
.tf-rich-editor :deep(.w-e-bar-item) {
  flex: 0 0 auto;
}
.tf-rich-editor :deep(.w-e-bar-item-group .w-e-bar-item-menus-container) {
  box-sizing: border-box;
  display: none;
  flex-wrap: wrap;
  width: max-content;
  max-width: min(320px, calc(100vw - 7rem));
  max-height: min(50vh, 360px);
  overflow: auto;
  overscroll-behavior: contain;
  z-index: var(--tf-z-popper);
}
.tf-rich-editor :deep(.w-e-bar-item-group:hover .w-e-bar-item-menus-container) {
  display: flex;
}
.tf-rich-editor :deep(.w-e-text-container) {
  height: min(360px, 50vh);
  min-height: 220px;
  overflow: auto;
  overflow-wrap: anywhere;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.tf-rich-editor :deep(.w-e-text-container [data-slate-editor] p) {
  margin-block: 0;
}
.tf-rich-editor__tools:empty { display: none; }
.tf-rich-editor__loading {
  position: absolute;
  inset: 42px 0 0;
  display: grid;
  place-items: center;
  background: var(--color-bg-white);
}
@media (max-width: 767px) {
  .tf-rich-editor :deep(.w-e-bar-item-group .w-e-bar-item-menus-container) {
    max-width: min(260px, calc(100vw - 7rem));
  }

  .tf-rich-editor :deep(.w-e-text-container) {
    height: min(280px, 42vh);
    min-height: 180px;
  }
}
</style>
