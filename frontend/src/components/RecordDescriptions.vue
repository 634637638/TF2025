<script lang="ts">
import { cloneVNode, defineComponent, Fragment, h, isVNode, type PropType, type VNode, type VNodeChild } from 'vue'
import { ElDescriptions, type DescriptionProps } from 'element-plus'
// render 函数中的组件不会触发模板按需样式解析，公共入口负责加载描述列表样式。
import 'element-plus/es/components/descriptions/style/css'
import { useMobile } from '@/composables/mobile'

// 展开 v-if/v-for 的 Fragment，不引入无内容的占位字段。
function fields(nodes: readonly VNodeChild[]): VNode[] {
  return nodes.flatMap(node => {
    if (Array.isArray(node)) return fields(node)
    if (!isVNode(node)) return []
    if (node.type === Fragment && Array.isArray(node.children)) return fields(node.children)
    return typeof node.type === 'object' && 'name' in node.type && node.type.name === 'ElDescriptionsItem'
      ? [cloneVNode(node, { ...node.props })] : []
  })
}

export default defineComponent({
  name: 'RecordDescriptions',
  inheritAttrs: false,
  props: {
    column: { type: Number, default: 3 },
    compact: { type: Boolean, default: false },
    direction: { type: String as PropType<DescriptionProps['direction']>, default: 'horizontal' }
  },
  setup(props, { attrs, slots }) {
    const { isMobile } = useMobile()
    return () => h(ElDescriptions, {
      ...attrs,
      class: ['tf-record-descriptions', { 'tf-record-descriptions--compact': props.compact }, attrs.class],
      column: isMobile.value ? 2 : props.column,
      direction: props.compact ? 'horizontal' : isMobile.value ? 'vertical' : props.direction,
      ...(props.compact ? { size: 'small' } : {})
    }, {
      ...slots,
      default: () => {
        const items = fields(slots.default?.() || [])
        if (!isMobile.value) return items
        let occupied = false
        return items.map((item, index) => {
          const wide = Number(item.props?.span || 1) > 1
          // Element Plus 会把跨行字段截到本行剩余列数。补满前一短字段，确保长字段从新行开始。
          if (wide && occupied) items[index - 1].props = { ...items[index - 1].props, span: 2 }
          item.props = { ...item.props, span: wide || (!occupied && index === items.length - 1) ? 2 : 1 }
          occupied = wide ? false : !occupied
          return item
        })
      }
    })
  }
})
</script>
