<template>
  <div class="auth-page">
    <div class="auth-card">
      <header class="auth-header">
        <div class="auth-logo">
          <IconRenderer :icon="`fas ${icon}`" />
        </div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </header>
      <slot />
      <div class="auth-footer">
        <span>{{ footerText }}</span>
        <router-link :to="footerTo">{{ footerLabel }}</router-link>
      </div>
      <div class="auth-home">
        <router-link to="/m"><i class="fas fa-arrow-left" /> 返回首页</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconRenderer from '@/components/IconRenderer.vue'

defineProps<{
  title: string
  icon: string
  subtitle: string
  footerText: string
  footerLabel: string
  footerTo: string
}>()
</script>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tf-space-5);
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
}
.auth-card {
  width: min(100%, var(--tf-h5-auth-card-max-width));
  min-width: 0;
  padding: var(--tf-space-7) var(--tf-space-6);
  border-radius: var(--tf-radius-dialog);
  background: var(--color-bg-white);
  box-shadow: var(--tf-shadow-card);
}
.auth-header {
  text-align: center;
  margin-bottom: var(--tf-space-7);
  h1 {
    margin: 0 0 var(--tf-space-2);
    font-size: var(--tf-type-scale-24);
    font-weight: 600;
    color: var(--text-primary);
  }
  p {
    margin: 0;
    font-size: var(--tf-type-scale-14);
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
}
.auth-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--tf-space-7) * 2);
  height: calc(var(--tf-space-7) * 2);
  margin: 0 auto var(--tf-space-4);
  border-radius: var(--tf-radius-full);
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  font-size: var(--tf-type-scale-32);
  color: var(--color-bg-white);
}
:deep(.auth-form) {
  .el-form-item { margin-bottom: var(--tf-space-5); }
  .el-input__prefix { color: var(--text-muted); }
  .el-button { margin-top: var(--tf-space-2); }
  .el-checkbox { max-width: 100%; height: auto; }
  .el-checkbox__label {
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: var(--tf-type-scale-13);
    color: var(--text-secondary);
  }
}
.auth-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--tf-space-1);
  margin-top: var(--tf-space-4);
  font-size: var(--tf-type-scale-14);
  color: var(--text-secondary);
  a { color: var(--tf-color-indigo-brand); font-weight: 500; text-decoration: none; }
}
.auth-home {
  text-align: center;
  margin-top: var(--tf-space-6);
  a {
    display: inline-flex;
    align-items: center;
    gap: var(--tf-space-1);
    font-size: var(--tf-type-scale-13);
    color: var(--text-muted);
    text-decoration: none;
  }
}
</style>
