<template>
  <!--
    首页看板（对应原型 首页.html）

    六个区块各对应《05-接口文档.md》第九节的一个接口：
      快捷入口 / 待办事项 / 我关注的 / 消息 / 公告|通知 / 实时数据
  -->
  <div v-loading="loading" class="dashboard">
    <h2 class="dashboard__page-title">首页</h2>

    <template v-if="loaded">
      <quick-entry class="dashboard__full" :entries="shortcuts" />

      <div class="dashboard__col">
        <todo-stats :stats="todoStats" @select="goPath($event.path)" />

        <my-focus
          :tabs="FOCUS_TABS"
          :columns="focusColumns"
          :maps="focusMaps"
          :rows="focusRows"
          @change="loadFocus"
          @more="goPath"
        />

        <realtime-stats
          :stats="realtimeStats"
          :ranges="REALTIME_RANGES"
          @change="loadStats"
        />
      </div>

      <div class="dashboard__col">
        <funnel-chart :data="funnel" />
        <trend-chart :data="trend" :range="trendRange" :ranges="REALTIME_RANGES" @change="loadTrend" />
        <message-panel title="消息" :list="messages" />
        <message-panel title="公告 | 通知" :list="notices" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import QuickEntry from './components/QuickEntry.vue'
import TodoStats from './components/TodoStats.vue'
import MyFocus from './components/MyFocus.vue'
import MessagePanel from './components/MessagePanel.vue'
import RealtimeStats from './components/RealtimeStats.vue'
import FunnelChart from './components/FunnelChart.vue'
import TrendChart from './components/TrendChart.vue'

import {
  getDashboardShortcuts,
  getDashboardTodo,
  getDashboardFocus,
  getDashboardMessages,
  getDashboardNotices,
  getDashboardStats,
  getDashboardFunnel,
  getDashboardTrend
} from '@/api/dashboard'

import { TODO_META, REALTIME_META, REALTIME_RANGES, FOCUS_TABS, FOCUS_COLUMNS, FOCUS_MAP_TYPES, AI_ENTRY } from './constants'
import { useAiStore } from '@/store/ai'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'

// 预热没跑到或失败过时补一次（正常情况零请求）
ensureDictOptions(Object.values(FOCUS_MAP_TYPES))

const route = useRoute()
const router = useRouter()
const aiStore = useAiStore()

/**
 * 「我关注的」里几列字典字段的码值 → 中文
 *
 * ⚠️ 必须在这里（setup 顶层）建 computed 传给 MyFocus，不能像以前那样在
 *    constants.js 里写成一个模块级常量对象 —— 那是一次性快照，会在字典接口
 *    返回之前就定格，表现是看板首屏这几列全是 `--`。
 *    MyFocus 那边的接口不变（`props.maps[col.map]?.[raw]`）。
 */
const sourceMap = useDictMap('crm_source')
const industryMap = useDictMap('crm_industry')
const levelMap = useDictMap('crm_customer_level')
const dealStatusMap = useDictMap('crm_deal_status')

const focusMaps = computed(() => ({
  SOURCE: sourceMap.value,
  INDUSTRY: industryMap.value,
  LEVEL: levelMap.value,
  DEAL_STATUS: dealStatusMap.value
}))

const loading = ref(true)
/**
 * 数据到位后才渲染子组件。
 * 子组件用 props 初始化本地 state（如「我关注的」默认选中第一个页签），
 * 提前挂载会拿到空数组，选中项就永远是空的。
 */
const loaded = ref(false)

/** 接口原始返回，按文档字段名存着，由 META 映射成展示所需结构 */
const todoRaw = ref(null)
const statsRaw = ref(null)

const shortcuts = ref([])
const messages = ref([])
const notices = ref([])
const focusRows = ref([])

/** 销售漏斗与趋势图（echarts） */
const funnel = ref([])
const trend = ref([])
const trendRange = ref(REALTIME_RANGES[0].value)
const focusColumns = ref(FOCUS_COLUMNS.lead)

/** 展示元数据 + 接口数值 → TodoStats 需要的结构 */
const todoStats = computed(() =>
  TODO_META.map((meta) => ({ ...meta, value: todoRaw.value?.[meta.key] ?? '--' }))
)

const realtimeStats = computed(() =>
  REALTIME_META.map((meta) => ({ ...meta, value: statsRaw.value?.[meta.key] ?? 0 }))
)

async function loadStats(range) {
  statsRaw.value = await getDashboardStats(range)
}

/** 趋势图的时间维度与「实时数据」共用同一套取值，但两者独立切换 */
async function loadTrend(range) {
  trendRange.value = range
  trend.value = (await getDashboardTrend(range)) || []
}

/** 切换单据类型页签 / 我关注的↔我负责的 */
async function loadFocus({ tab, scope }) {
  const data = await getDashboardFocus({ tab, scope, pageNo: 1, pageSize: 20 })
  focusRows.value = data?.list || []
  // ⚠️ 没有列定义时传 `[]`，**不要**兜底成 FOCUS_COLUMNS.lead ——
  //    回款/发票两个页签后端暂时返回空页（财务模块未实现），
  //    套用线索的列会让表头全是「线索来源」这类完全对不上的名称。
  focusColumns.value = FOCUS_COLUMNS[tab] || []
}

/**
 * 跳到列表页
 *
 * 路由存在才跳 —— 比如 `/dashboard` 自身就没必要再 push 一次（同路径 Vue Router
 * 会抛 NavigationDuplicated 警告）。
 */
function goPath(path) {
  if (!path || path === route.path) return
  router.push(path)
}

onMounted(async () => {
  try {
    // 八个区块互不依赖，并行拉取
    const [sc, todo, stats, msgs, nts, focus, fn, tr] = await Promise.all([
      getDashboardShortcuts(),
      getDashboardTodo(),
      getDashboardStats(REALTIME_RANGES[0].value),
      getDashboardMessages({ pageNo: 1, pageSize: 5 }),
      getDashboardNotices({ pageNo: 1, pageSize: 5 }),
      getDashboardFocus({ tab: FOCUS_TABS[0].value, scope: 'mine', pageNo: 1, pageSize: 20 }),
      getDashboardFunnel(),
      getDashboardTrend(REALTIME_RANGES[0].value)
    ])

    // AI 入口由前端合成并放在最前：它是唯一一个「不跳路由、开浮层」的入口，
    // 混在十几个跳转入口里不显眼，放队首更容易被发现。
    const shortcutList = sc || []
    shortcuts.value = aiStore.permitted ? [AI_ENTRY, ...shortcutList] : shortcutList
    todoRaw.value = todo
    statsRaw.value = stats
    messages.value = msgs?.list || []
    notices.value = nts?.list || []
    focusRows.value = focus?.list || []
    funnel.value = fn || []
    trend.value = tr || []
    loaded.value = true
  } catch (e) {
    console.error('[首页看板] 数据加载失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.dashboard {
  display: grid;
  // 原型左栏 1309 / 右栏 551（间距 16），用 fr 保持比例
  grid-template-columns: minmax(0, 1309fr) minmax(0, 551fr);
  gap: 16px;
  align-items: start;
  min-height: 200px;
}

.dashboard__page-title {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.dashboard__full {
  grid-column: 1 / -1;
}

.dashboard__col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

// 窄屏改为单列堆叠（右栏 551fr 在 1100px 以下会挤得不好读）
@media (max-width: 1100px) {
  .dashboard {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
