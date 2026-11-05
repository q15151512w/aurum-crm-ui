<template>
  <panel-card title="实时数据">
    <template #extra>
      <span
        v-for="r in ranges"
        :key="r.value"
        class="range"
        :class="{ 'is-active': r.value === activeRange }"
        @click="switchRange(r)"
      >
        {{ r.label }}
      </span>
    </template>

    <div class="rt">
      <div v-for="item in stats" :key="item.key" class="rt__item">
        <span class="rt__label">{{ item.label }}</span>
        <span class="rt__value">{{ format(item) }}</span>
      </div>
    </div>
  </panel-card>
</template>

<script setup>
import { ref } from 'vue'
import PanelCard from './PanelCard.vue'

const props = defineProps({
  /** [{ key, label, value, money }] */
  stats: { type: Array, default: () => [] },
  /** [{ label, value }] */
  ranges: { type: Array, default: () => [] }
})

const emit = defineEmits(['change'])

const activeRange = ref(props.ranges[0]?.value ?? '')

function switchRange(r) {
  if (r.value === activeRange.value) return
  activeRange.value = r.value
  emit('change', r.value)
}

/** 金额类指标带千分位和两位小数，计数类直接展示（由 META 里的 money 标记决定） */
function format(item) {
  const n = Number(item.value)
  if (!Number.isFinite(n)) return '--' // 字段权限可能把金额置 null
  if (!item.money) return n
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<style scoped lang="scss">
.range {
  color: var(--crm-text-secondary);
  cursor: pointer;

  &:hover,
  &.is-active {
    color: var(--crm-primary);
  }

  &.is-active {
    font-weight: 600;
  }
}

.rt {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px 8px;
}

.rt__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.rt__label {
  font-size: 13px;
  color: var(--crm-text-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rt__value {
  font-size: 20px;
  font-weight: 700;
  color: var(--crm-text-primary);
}
</style>
