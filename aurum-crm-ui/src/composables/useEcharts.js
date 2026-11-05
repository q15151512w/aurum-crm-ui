import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

/**
 * ECharts 的挂载/更新/销毁封装
 *
 * 三件必须做的事，漏一件就会出怪问题：
 *   1. **容器要有确定的高度** —— ECharts 在 0 高度的容器上初始化会画不出来，
 *      而且没有任何报错。所以图表容器的高度写在组件样式里，不能靠内容撑。
 *   2. **监听 resize** —— 左侧导航折叠、浏览器窗口变化都会改宽度，
 *      不重新 resize 图表就是错位的。
 *   3. **onBeforeUnmount 必须 dispose** —— 不销毁的话组件反复切换会泄漏实例。
 *
 * @param {Function} optionFactory 返回 echarts option 的函数，参数是「数据源」的当前值
 * @param {Ref} dataSource 数据 ref，变化时自动重画
 */
export function useEcharts(optionFactory, dataSource) {
  const chartRef = ref(null)
  let chart = null

  /**
   * 统一取值入口
   *
   * ⚠️ 这里踩过坑：dataSource 两种写法都得支持 ——
   *      · 传 ref：   `useEcharts(fn, dataRef)`
   *      · 传 getter：`useEcharts(fn, () => props.data)`
   *    早先只写了 `dataSource.value`，而两个图表组件传的都是 getter 函数 ——
   *    函数没有 `.value`，取到 undefined，接着 optionFactory(undefined) 里
   *    `rows.map()` 直接抛 TypeError，onMounted 挂掉，图表**一点都画不出来**。
   */
  const getData = typeof dataSource === 'function' ? dataSource : () => dataSource?.value

  function render() {
    if (!chart) return
    const data = getData()

    // 数据还没到就先不画 —— 画空图会在页面上留个突兀的空框
    if (!Array.isArray(data) || !data.length) {
      chart.clear()
      return
    }

    try {
      // notMerge=true：时间维度切换时系列数量可能变，合并的话会留下上一份的残影
      chart.setOption(optionFactory(data), true)
    } catch (e) {
      // 画不出来要能看见。否则页面上就是一块空白，还得从头查起
      console.error('[useEcharts] setOption 失败', e)
    }
  }

  function resize() {
    chart?.resize()
  }

  onMounted(async () => {
    await nextTick()
    if (!chartRef.value) return
    chart = echarts.init(chartRef.value)
    render()

    // ⚠️ 保险：init 时容器若还没拿到宽度（flex/grid 布局首帧常见），
    //    ECharts 会按 0 宽画，且**不报错**，页面上就是一块空白。
    //    下一帧布局稳定后再 resize 一次，把这种情况兜住。
    requestAnimationFrame(resize)

    window.addEventListener('resize', resize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    chart?.dispose()
    chart = null
  })

  if (dataSource) watch(getData, render, { deep: true })

  return { chartRef, render, resize }
}
