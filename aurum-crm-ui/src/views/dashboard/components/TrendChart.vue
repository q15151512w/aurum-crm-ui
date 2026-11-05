<template>
  <panel-card title="趋势">
    <template #extra>
      <!-- 时间维度与「实时数据」共用同一套取值（day / week / month）-->
      <span
        v-for="r in ranges"
        :key="r.value"
        class="trend__range"
        :class="{ 'is-active': r.value === range }"
        @click="emit('change', r.value)"
      >
        {{ r.label }}
      </span>
    </template>
    <div ref="chartRef" class="trend__chart" />
    <el-empty v-if="!data.length" description="暂无趋势数据" :image-size="60" />
  </panel-card>
</template>

<script setup>
import PanelCard from './PanelCard.vue'
import { useEcharts } from '@/composables/useEcharts'

const props = defineProps({
  /** [{ date, leadCount, customerCount, contractCount, salesAmount }] */
  data: { type: Array, default: () => [] },
  /** 当前时间维度 */
  range: { type: String, default: 'month' },
  /** [{ label, value }] */
  ranges: { type: Array, default: () => [] }
})

const emit = defineEmits(['change'])

const { chartRef } = useEcharts(
  (rows) => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增线索', '新增客户', '新增合同'], top: 0, itemHeight: 8, textStyle: { fontSize: 12 } },
    grid: { left: 8, right: 8, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.date),
      axisLine: { lineStyle: { color: '#dfe1e6' } },
      axisLabel: { color: '#6b778c', fontSize: 11 }
    },
    // 两个 y 轴：单据数量是「个」，销售额是「元」，量级差太多，挤一个轴上小的看不见
    yAxis: [
      {
        type: 'value',
        name: '数量',
        nameTextStyle: { color: '#6b778c', fontSize: 11 },
        axisLabel: { color: '#6b778c', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f1f3' } }
      },
      {
        type: 'value',
        name: '金额',
        nameTextStyle: { color: '#6b778c', fontSize: 11 },
        axisLabel: { color: '#6b778c', fontSize: 11, formatter: (v) => (v >= 10000 ? v / 10000 + '万' : v) },
        splitLine: { show: false }
      }
    ],
    series: [
      { name: '新增线索', type: 'line', smooth: true, data: rows.map((r) => r.leadCount), itemStyle: { color: '#2c6ddb' } },
      { name: '新增客户', type: 'line', smooth: true, data: rows.map((r) => r.customerCount), itemStyle: { color: '#17b0c4' } },
      { name: '新增合同', type: 'line', smooth: true, data: rows.map((r) => r.contractCount), itemStyle: { color: '#28d094' } },
      {
        name: '销售金额',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 18,
        itemStyle: { color: 'rgba(44,109,219,0.16)' },
        data: rows.map((r) => r.salesAmount)
      }
    ]
  }),
  () => props.data
)
</script>

<style scoped lang="scss">
// ⚠️ 同漏斗图：必须有确定高度，否则 ECharts 静默画不出来
.trend__chart {
  width: 100%;
  height: 240px;
}

.trend__range {
  margin-left: 12px;
  font-size: 13px;
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
</style>
