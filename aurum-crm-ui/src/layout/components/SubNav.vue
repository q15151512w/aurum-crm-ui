<template>
  <!--
    左侧二级导航（原型 #u3737：200x1024 @(0,56)，白底 + 阴影）

    条目来自当前一级模块的 children。首页这类没有二级页的模块不渲染本组件 ——
    原型上首页也确实没有这条白底侧栏，是全宽看板。
  -->
  <aside v-if="items.length" class="sub-nav">
    <div
      v-for="item in items"
      :key="item.menuId"
      class="sub-nav__item"
      :class="{ 'is-active': item.menuId === activeMenuId }"
      @click="router.push(item.path)"
    >
      {{ item.menuName }}
    </div>
  </aside>
</template>

<script setup>
import { useRouter } from 'vue-router'

defineProps({
  /** 当前一级模块下的二级页（已由 permissionStore 过滤掉按钮与隐藏项） */
  items: { type: Array, default: () => [] },
  /** 当前路由对应的菜单节点 id，用于高亮 */
  activeMenuId: { type: Number, default: null }
})

const router = useRouter()
</script>

<style scoped lang="scss">
.sub-nav {
  width: var(--crm-subnav-width);
  flex-shrink: 0;
  padding-top: 20px;
  background-color: var(--crm-bg-white);
  box-shadow: var(--crm-shadow);
  overflow-y: auto;

  &__item {
    height: var(--crm-subnav-item-height);
    line-height: var(--crm-subnav-item-height);
    margin-bottom: var(--crm-subnav-item-gap);
    padding: 0 24px;
    font-size: 16px;
    color: var(--crm-text-regular);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background-color 0.2s, color 0.2s;

    &:hover {
      background-color: var(--crm-bg-hover);
      color: var(--crm-primary);
    }

    &.is-active {
      background-color: var(--crm-primary-light);
      color: var(--crm-primary);
      font-weight: 600;
    }
  }
}
</style>
