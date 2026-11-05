<template>
  <!--
    主框架布局（原型是三层结构）

    ┌──────────────────────────────────────────────┐
    │ TopNav   顶部一级导航（主色底，8 项）           │
    ├────────┬─────────────────────────────────────┤
    │ SubNav │ 内容区（router-view）                │
    │ 二级导航│                                     │
    └────────┴─────────────────────────────────────┘

    首页没有二级页，SubNav 不渲染，内容区自动占满整宽。
  -->
  <div class="app-wrapper">
    <TopNav />

    <div class="app-body">
      <SubNav :items="subMenus" :active-menu-id="activeMenuId" />

      <main class="app-main">
        <!--
          :key 用 route.path —— 占位页全都复用 PageStub 组件，不加 key 时
          前后两个路由会解析成同一个 vnode 而被复用，页面内容不更新。

          transition 不要加 mode="out-in"，原因见 styles/index.scss 的说明。

          ⚠️⚠️ 下面这层 <div class="app-page"> 是**必需的**，不要删、也不要把 :key 挪回
          <component> 上 —— 它给 <Transition> 提供了「永远是单个元素」的子节点。

          背景（这是一个真实踩过的坑，症状极具误导性）：
          `Transition` 要求子节点是**一个元素**，而本项目的页面组件**大量是多根节点** ——
          典型的是「列表 + 弹窗」两个平级根（`pro-list` + `config-form-dialog`），
          以及**模板顶层的 HTML 注释**（注释也占一个根节点）。

          ⚠️ 上面的组件名**故意不带尖括号**：check-static 会扫本文件里的自定义标签并
             检查有没有 import，注释里写成标签字面量会被它误判成「用了但没 import」。
          此时 Vue 会警告：
            Component inside <Transition> renders non-element root node that cannot be animated
          并且**无法正常卸载离场组件** —— 表现为「点了别的菜单，内容区却还停在上一页」，
          而地址栏是正确的（所以会一路错怪路由守卫 / keep-alive / 菜单数据）。

          ⚠️ 这个坑**只在开发模式复现**：生产构建会剥掉模板注释（compiler 的 comments: false），
          所以「线上没事、dev 上有事」，进一步增加了排查难度。

          包一层 div 就一次性解决全部页面 —— 不用去改那 55 个多根节点的组件。
        -->
        <router-view v-slot="{ Component, route }">
          <transition name="fade-transform">
            <div :key="route.path" class="app-page">
              <component :is="Component" />
            </div>
          </transition>
        </router-view>
      </main>
    </div>

    <!--
      AI 小助手：全局【唯一一份】。顶栏入口、首页快捷入口、悬浮球操作的都是它。

      ⚠️ 必须 Teleport 到 body：.app-wrapper 上面有 overflow: hidden，
          留在里面会被裁掉；而且 position: fixed 一旦碰到带 transform 的祖先，
          包含块就不再是视口了。放在这里也保证它不会随 router-view 的
          :key="route.path" 重建 —— 切页面时对话不中断。
    -->
    <Teleport to="body">
      <!-- 已经在 AI 整页里就不显示悬浮球了 —— 那一页本身就是完整对话界面，
           再叠一个浮层只会挡住内容 -->
      <template v-if="aiStore.permitted && !isAiPage">
        <AiFloatingBall />
        <AiChatPanel />
      </template>
    </Teleport>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TopNav from './components/TopNav.vue'
import SubNav from './components/SubNav.vue'
import AiFloatingBall from '@/views/ai/components/AiFloatingBall.vue'
import AiChatPanel from '@/views/ai/components/AiChatPanel.vue'
import { useActiveMenu } from '@/composables/useActiveMenu'
import { useAiStore } from '@/store/ai'

// 顶部一级导航的选中态由 TopNav 自己算（同一个 composable，派生自同一份 store + route，
// 两边结果必然一致，不是两处状态）
const { subMenus, activeMenuId } = useActiveMenu()

const aiStore = useAiStore()
const route = useRoute()

/** AI 整页的路径，与 router/index.js 里静态注册的那条一致 */
const AI_CHAT_PATH = '/ai/chat'

/**
 * 是否在 AI 整页上。
 *
 * ⚠️ 用 `startsWith` 而不是全等：将来若给这一页加子路由（如 /ai/chat/:id），
 *    全等会漏掉子路径，悬浮球又冒出来。
 */
const isAiPage = computed(() => route.path.startsWith(AI_CHAT_PATH))
</script>

<style scoped lang="scss">
.app-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  // 不加这行，子元素会把 flex 容器撑高而不是自己出滚动条
  min-height: 0;
}

.app-main {
  flex: 1;
  // 防止内容过宽时把 flex 项撑破
  min-width: 0;
  padding: var(--crm-content-gap);
  overflow-y: auto;
  background-color: var(--crm-bg-page);
  // 路由切换时离场元素是 position:absolute（见 styles/index.scss），
  // 这里给出定位上下文，让它是相对内容区而不是视口定位
  position: relative;
}
</style>
