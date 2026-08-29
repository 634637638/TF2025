<template>
  <div class="not-found">
    <div class="content">
      <h1>404</h1>
      <h2>页面未找到</h2>
      <p>抱歉，您访问的页面不存在</p>
      <el-button
        type="primary"
        @click="goHome"
      >
        返回首页
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--tf-color-surface-soft);
}

.content {
  text-align: center;
  padding: 40px;
}

.content h1 {
  font-size: 120px;
  margin: 0;
  color: var(--color-primary);
}

.content h2 {
  font-size: 32px;
  margin: 20px 0;
  color: var(--text-primary);
}

.content p {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 30px;
}
</style>