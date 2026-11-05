<template>
  <div class="error-page">
    <div class="error-code">404</div>
    <div class="error-desc">抱歉，你访问的页面不存在</div>
    <el-button type="primary" @click="goHome">返回首页</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import settings from '@/settings'

const router = useRouter()

function goHome() {
  router.push(settings.homePath)
}
</script>

<style scoped lang="scss">
.error-page {
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.error-code {
  font-size: 96px;
  font-weight: 700;
  color: #dcdfe6;
  line-height: 1;
  letter-spacing: 4px;
}

.error-desc {
  font-size: 15px;
  color: #909399;
  margin-bottom: 8px;
}
</style>
