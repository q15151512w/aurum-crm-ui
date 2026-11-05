<template>
  <!--
    看板面板外壳

    原型上「快捷入口 / 待办事项 / 我关注的 / 消息 / 公告|通知 / 实时数据」
    六个区块都是同一个样式：白底、圆角 8、标题在左上、右上可选一个「查看全部」。
  -->
  <section class="panel">
    <header class="panel__head">
      <h3 class="panel__title">{{ title }}</h3>
      <div class="panel__extra">
        <slot name="extra" />
        <a v-if="more" class="panel__more" @click="emit('more')">查看全部</a>
      </div>
    </header>

    <div class="panel__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  /** 是否显示右上角「查看全部」 */
  more: { type: Boolean, default: false }
})

const emit = defineEmits(['more'])
</script>

<style scoped lang="scss">
.panel {
  background-color: var(--crm-bg-white);
  border-radius: 8px;
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.panel__extra {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.panel__more {
  color: var(--crm-text-secondary);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: var(--crm-primary);
  }
}

.panel__body {
  flex: 1;
  min-height: 0;
}
</style>
