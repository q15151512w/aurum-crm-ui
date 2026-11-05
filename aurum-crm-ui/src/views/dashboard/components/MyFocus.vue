<template>
  <panel-card title="我关注的" more @more="onMore">
    <template #extra>
      <!-- 原型上「我关注的 / 我负责的」是同一个位置的两个切换项 -->
      <span
        v-for="s in SCOPES"
        :key="s.value"
        class="scope"
        :class="{ 'is-active': s.value === scope }"
        @click="switchScope(s.value)"
      >
        {{ s.label }}
      </span>
    </template>

    <div class="focus__tabs">
      <span
        v-for="tab in tabs"
        :key="tab.value"
        class="focus__tab"
        :class="{ 'is-active': tab.value === activeTab }"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </span>
    </div>

    <el-table :data="rows" size="small" style="width: 100%">
      <el-table-column width="50" align="center">
        <template #header>
          <span class="focus__star-head">关注</span>
        </template>
        <template #default="{ row }">
          <el-icon :size="16" :color="row.starred ? '#f5a623' : '#dcdfe6'">
            <StarFilled v-if="row.starred" />
            <Star v-else />
          </el-icon>
        </template>
      </el-table-column>

      <el-table-column
        v-for="(col, i) in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        show-overflow-tooltip
      >
        <!--
          首列（名称）用链接色，与原型的列表页一致。
          ⚠️ 每一列都要走 cellText，不能只给首列写 slot ——
             字典字段（来源/行业/级别/成交状态）后端返回的是码值，
             裸渲染会显示成 `3`、`5` 这样的数字。
        -->
        <template #default="{ row }">
          <span :class="{ focus__link: i === 0 }">{{ cellText(col, row) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!rows.length" description="暂无数据" :image-size="60" />
  </panel-card>
</template>

<script setup>
import { ref } from 'vue'
import { Star, StarFilled } from '@element-plus/icons-vue'
import { formatMoney } from '@/utils/number'
import PanelCard from './PanelCard.vue'

const props = defineProps({
  /** [{ label, value, path }]，value 对应接口文档 9.3 的 tab 参数，path 是列表页路由 */
  tabs: { type: Array, default: () => [] },
  /** 列定义，见 constants.js 的 FOCUS_COLUMNS；列上的 map / money 键在这里被消费 */
  columns: { type: Array, default: () => [] },
  /**
   * 码值映射表：`{ 列上 map 键的值: { 码值: 标签 } }`
   *
   * 由 index.vue 用 `useDictMap`（`composables/useDictOptions.js`）建好传进来 ——
   * 「哪一列用哪张字典」的类型表是 `constants.js` 的 `FOCUS_MAP_TYPES`，
   * 映射表本身**不能在 constants.js 里写死**（快照会在字典到达前定格，整列 `--`）。
   */
  maps: { type: Object, default: () => ({}) },
  rows: { type: Array, default: () => [] }
})

/**
 * 单元格的显示值。
 *
 * 三种情况，顺序不能颠倒：
 *   1. 空值 → `--`（后端对 null 字段会整个省略，`row[prop]` 是 undefined）
 *   2. 列上配了 `map` → 字典字段，把码值翻成中文
 *   3. 列上配了 `money` → 金额格式化（与 ProList 用同一个 formatMoney）
 *
 * ⚠️ 状态机字段（商机 stage / 报价单 status / 合同 auditStatus）**不走 map** ——
 *    后端已经返回中文标签了，这里再映射一次会全部变成 `--`。
 */
function cellText(col, row) {
  const raw = row[col.prop]
  if (raw === null || raw === undefined || raw === '') return '--'
  if (col.map) {
    return props.maps[col.map]?.[raw] ?? '--'
  }
  if (col.money) {
    return formatMoney(raw)
  }
  return raw
}

/** more 带出当前页签的路由 —— 「查看全部」应该跳到当前这一类的列表页 */
const emit = defineEmits(['change', 'more'])

function onMore() {
  const tab = props.tabs.find((t) => t.value === activeTab.value)
  if (tab?.path) emit('more', tab.path)
}

/**
 * 「我关注的 / 我负责的」—— value 是接口文档 9.3 的 scope 参数。
 *
 * ⚠️ 这里的取值**必须和各模块列表页的筛选胶囊一致**（{@code lead/index.vue} 等的 FILTERS）：
 *   starred 我关注的 / mine 我负责的 / subordinate 下属负责的
 *
 * 这两个值曾经写反过：看板把「我关注的」发成 `mine`、把「我负责的」发成 `subordinate`，
 * 而各模块列表里 `mine` 恰恰是「我负责的」。同一个参数名在两处表达不同含义，
 * 后端只能按模块口径解释，于是看板的两个切换项拿到的都是错的数据。
 */
const SCOPES = [
  { label: '我关注的', value: 'starred' },
  { label: '我负责的', value: 'mine' }
]

const activeTab = ref(props.tabs[0]?.value ?? 'lead')
const scope = ref('mine')

function switchTab(value) {
  if (value === activeTab.value) return
  activeTab.value = value
  emit('change', { tab: value, scope: scope.value })
}

function switchScope(value) {
  if (value === scope.value) return
  scope.value = value
  emit('change', { tab: activeTab.value, scope: value })
}
</script>

<style scoped lang="scss">
.scope {
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

.focus__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--crm-border-light);
  margin-bottom: 12px;
  overflow-x: auto;
}

.focus__tab {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--crm-text-regular);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;

  &:hover {
    color: var(--crm-primary);
  }

  &.is-active {
    color: var(--crm-primary);
    font-weight: 600;
    border-bottom-color: var(--crm-primary);
  }
}

.focus__link {
  color: var(--crm-primary);
  cursor: pointer;
}

.focus__star-head {
  color: var(--crm-text-regular);
}
</style>
