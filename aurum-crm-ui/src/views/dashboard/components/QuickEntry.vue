<template>
  <panel-card title="快捷入口">
    <!--
      原型上 15 个入口排成一整行（每项间距 122px）。
      这里用 auto-fill 网格：宽屏自然铺成一行，窄屏自动换行，不用写死列数。
    -->
    <div class="quick">
      <div
        v-for="item in entries"
        :key="item.path"
        class="quick__item"
        @click="router.push(item.path)"
      >
        <div class="quick__icon" :style="{ backgroundColor: item.color }">
          <el-icon :size="22"><component :is="item.icon" /></el-icon>
        </div>
        <span class="quick__name">{{ item.name }}</span>
      </div>
    </div>
  </panel-card>
</template>

<script setup>
import { useRouter } from 'vue-router'
import PanelCard from './PanelCard.vue'

defineProps({
  entries: { type: Array, default: () => [] }
})

const router = useRouter()
</script>

<style scoped lang="scss">
.quick {
  display: grid;
  // 原型上 15 个入口是整整齐齐一行。列宽给到足够小，宽屏时正好铺满一行不换行，
  // 窄屏再自然折行 —— 写死 15 列的话窄屏会挤成一团。
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 16px 8px;
}

.quick__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  &:hover .quick__name {
    color: var(--crm-primary);
  }
}

.quick__icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.quick__name {
  font-size: 13px;
  color: var(--crm-text-regular);
  white-space: nowrap;
  transition: color 0.2s;
}
</style>
