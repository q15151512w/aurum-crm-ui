<template>
  <panel-card title="销售漏斗">
    <template #extra>
      <span class="funnel__hint">按商机阶段</span>
    </template>
    <div ref="chartRef" class="funnel__chart" />
    <el-empty v-if="!data.length" description="暂无漏斗数据" :image-size="60" />
  </panel-card>
</template>

<script setup>
import PanelCard from './PanelCard.vue'
import { useEcharts } from '@/composables/useEcharts'

const props = defineProps({
  /** [{ stage, count, amount }] */
  data: { type: Array, default: () => [] }
})

/** 漏斗用阶段色：越往后越「热」，与列表页的 STAGE_TAG 配色一致 */
const STAGE_COLORS = ['#a8c5ef', '#7fa8e8', '#4f83dd', '#2c6ddb', '#1f9d55']

const { chartRef } = useEcharts(
  (rows) => ({
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const r = rows[p.dataIndex]
        return `${r.stage}<br/>商机数：${r.count} 个<br/>预计金额：¥${Number(r.amount).toLocaleString('zh-CN')}`
      }
    },
    series: [
      {
        type: 'funnel',
        left: '6%',
        right: '6%',
        top: 8,
        bottom: 8,
        minSize: '32%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontSize: 12,
          formatter: (p) => `${p.name}　${p.value}`
        },
        itemStyle: { borderWidth: 0 },
        data: rows.map((r, i) => ({
          name: r.stage,
          value: r.count,
          itemStyle: { color: STAGE_COLORS[i % STAGE_COLORS.length] }
        }))
      }
    ]
  }),
  () => props.data
)
</script>

<style scoped lang="scss">
// ⚠️ 必须有确定高度：ECharts 在 0 高度的容器上初始化会静默画不出来
.funnel__chart {
  width: 100%;
  height: 240px;
}

.funnel__hint {
  font-size: 12px;
  color: var(--crm-text-secondary);
}
</style>
