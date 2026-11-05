<template>
  <!--
    业务页占位组件

    按菜单树批量生成的页面文件都渲染它，等某一轮真正实现该页时，
    把对应页面文件整个替换掉即可（不再引用本组件）。

    和 views/_placeholder 的区别：
      _placeholder 是 loadView() 找不到组件时的兜底，说明菜单里配错了 component；
      本组件是「页面已登记但还没做」，属于计划内的正常状态。
  -->
  <div class="app-container">
    <el-card shadow="never">
      <el-empty :image-size="110">
        <template #description>
          <div class="stub-desc">
            <p class="stub-desc__title">{{ route.meta?.title || '未命名页面' }}</p>
            <p class="stub-desc__sub">该页面尚未实现，将在后续轮次按原型补全</p>
          </div>
        </template>

        <el-descriptions :column="1" border size="small" class="stub-meta">
          <el-descriptions-item label="路由路径">
            <code>{{ route.path }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="权限标识">
            <code>{{ route.meta?.perms || '—' }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="组件文件">
            {{ route.meta?.component || '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-empty>
    </el-card>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped lang="scss">
.stub-desc {
  &__title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 600;
    color: var(--crm-text-primary);
  }

  &__sub {
    margin: 0;
    font-size: 13px;
    color: var(--crm-text-secondary);
  }
}

.stub-meta {
  max-width: 560px;
  margin: 0 auto;
  text-align: left;

  code {
    background: var(--crm-bg-page);
    padding: 1px 6px;
    border-radius: 2px;
    font-size: 12px;
  }
}
</style>
