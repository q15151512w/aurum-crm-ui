<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-empty :image-size="120">
        <template #description>
          <div class="placeholder-desc">
            <p class="title">{{ route.meta?.title || '未命名页面' }}</p>
            <p class="sub">该功能尚未开发</p>
          </div>
        </template>

        <el-descriptions :column="1" border size="small" class="meta">
          <el-descriptions-item label="路由路径">
            <code>{{ route.path }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="菜单 ID">
            {{ route.meta?.menuId ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="权限标识">
            <code>{{ route.meta?.perms || '—' }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="组件">
            {{ route.meta?.component || '（未登记，回退到本占位页）' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 16px; text-align: left"
          title="这是占位页"
        >
          动态菜单已经跑通，但对应的业务页面还没写。
          在 <code>src/views/</code> 下按菜单里配置的
          <code>component</code> 路径创建组件后，本页会自动被替换。
        </el-alert>
      </el-empty>
    </el-card>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped lang="scss">
.placeholder-desc {
  .title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
  .sub {
    margin: 0;
    font-size: 13px;
    color: #909399;
  }
}

.meta {
  max-width: 560px;
  margin: 0 auto;
  text-align: left;

  code {
    background: #f0f2f5;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 12px;
  }
}
</style>
