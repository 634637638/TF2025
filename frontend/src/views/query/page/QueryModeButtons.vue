<template>
  <el-button
    :aria-pressed="modelValue === 'phone'"
    :type="modelValue === 'phone' ? 'primary' : 'default'"
    @click="modelValue = 'phone'"
  >
    综合查询
  </el-button>
  <el-button
    v-permission="'query:goods-view'"
    :aria-pressed="modelValue === 'goods'"
    :type="modelValue === 'goods' ? 'primary' : 'default'"
    @click="modelValue = 'goods'"
  >
    商品销售
  </el-button>
</template>

<script setup lang="ts">
const modelValue = defineModel<'phone' | 'goods'>({ required: true })
</script>
