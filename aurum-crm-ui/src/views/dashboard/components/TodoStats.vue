<template>
  <panel-card title="待办事项">
    <div class="todo">
      <!-- 每张卡片点进去就是对应的列表页；没配 path 的保持不可点 -->
      <div
        v-for="item in stats"
        :key="item.name"
        class="todo__card"
        :class="{ 'is-clickable': !!item.path }"
        @click="item.path && emit('select', item)"
      >
        <el-icon class="todo__icon" :size="26" :style="{ color: item.color }">
          <component :is="item.icon" />
        </el-icon>
        <div class="todo__text">
          <span class="todo__label">{{ item.name }}</span>
          <span class="todo__value">{{ item.value }}</span>
        </div>
      </div>
    </div>
  </panel-card>
</template>

<script setup>
import PanelCard from './PanelCard.vue'

defineProps({
  /** [{ name, value, icon, color, path }]，path 是跳转目标路由 */
  stats: { type: Array, default: () => [] }
})

/** select 传出被点的整项，由页面决定怎么跳 */
const emit = defineEmits(['select'])
</script>

<style scoped lang="scss">
.todo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

// 有跳转目标的卡片给个手型和悬浮反馈，否则用户不知道能点
.todo__card.is-clickable {
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--crm-bg-hover);
  }
}

.todo__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  // 原型上统计卡是浅蓝底
  background-color: var(--crm-primary-light);
}

.todo__icon {
  flex-shrink: 0;
}

.todo__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.todo__label {
  font-size: 13px;
  color: var(--crm-text-regular);
  white-space: nowrap;
}

.todo__value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--crm-text-primary);
}
</style>
