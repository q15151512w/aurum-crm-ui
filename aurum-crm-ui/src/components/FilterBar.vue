<template>
  <!--
    列表页筛选行（对应原型 y=129 那一行）

    ┌──────────────────────────────────────────────────────────────┐
    │ [搜索框]  显示： (全部线索)(我负责的)(下属负责的)(我关注的)  导出 高级筛选 │
    └──────────────────────────────────────────────────────────────┘

    「显示：」后面那排胶囊原型里是深藏青选中块，Element Plus 没有对应组件，
    所以这里自己实现。选项因模块而异，由 options 传入。
  -->
  <div class="filter-bar">
    <el-input
      v-if="searchable"
      :model-value="keyword"
      :placeholder="searchPlaceholder"
      clearable
      class="filter-bar__search"
      @update:model-value="emit('update:keyword', $event)"
      @keyup.enter="emit('search')"
      @clear="emit('search')"
    >
      <template #suffix>
        <el-icon class="filter-bar__search-icon"><Search /></el-icon>
      </template>
    </el-input>

    <span v-if="options.length" class="filter-bar__label">显示：</span>

    <span
      v-for="opt in options"
      :key="opt.value"
      class="filter-pill"
      :class="{ 'is-active': opt.value === modelValue }"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </span>

    <div class="filter-bar__right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'

defineProps({
  /** 当前选中的数据范围 */
  modelValue: { type: String, default: '' },
  /** [{ label, value }] */
  options: { type: Array, default: () => [] },
  searchable: { type: Boolean, default: true },
  keyword: { type: String, default: '' },
  searchPlaceholder: { type: String, default: '请输入关键字' }
})

const emit = defineEmits(['update:modelValue', 'update:keyword', 'search'])
</script>

<style scoped lang="scss">
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.filter-bar__search {
  width: 240px;
  margin-right: 8px;

  .filter-bar__search-icon {
    color: var(--crm-text-secondary);
  }
}

.filter-bar__label {
  font-size: 14px;
  color: var(--crm-text-primary);
  margin-right: 4px;
}

// 筛选胶囊：选中态是深藏青（不是主色蓝），这是原型的特征
.filter-pill {
  height: 32px;
  line-height: 32px;
  padding: 0 16px;
  border-radius: 4px;
  font-size: 14px;
  background-color: var(--crm-border-light);
  color: var(--crm-text-primary);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background-color: #e0e2e7;
  }

  &.is-active {
    background-color: var(--crm-text-primary);
    color: #fff;
  }
}

.filter-bar__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
