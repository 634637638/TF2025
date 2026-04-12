<template>
  <div class="auth-container">
    <h1>认证相关页面</h1>
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'Auth',
  description: '认证相关页面'
}
</script>

<style scoped>
.auth-container {
  padding: 20px;
}
</style>
