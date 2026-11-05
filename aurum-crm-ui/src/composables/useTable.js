import { ref, reactive, computed } from 'vue'

/**
 * 列表页状态与请求封装
 *
 * 每个列表页要维护的东西高度同构：查询条件、分页、loading、列表数据、勾选。
 * 抽出来，业务页面只关心「调哪个接口」和「列怎么渲染」。
 *
 * 后端分页约定（见 docs/05-接口文档.md）：
 *   请求  pageNo / pageSize
 *   响应  { list, total, pageNo, pageSize }
 * request.js 已经把 { code, message, data } 外壳剥掉了，这里直接拿 data。
 *
 * @param {Function} fetcher 形如 (query) => Promise<{list,total}> 的取数函数
 * @param {Object}   options
 * @param {Object}   options.initialQuery 初始查询条件（如 { status: 'all' }）
 * @param {Number}   options.pageSize     初始每页条数，原型默认 50
 * @param {Boolean}  options.immediate    是否立即加载，默认 true
 */
export function useTable(fetcher, options = {}) {
  const { initialQuery = {}, pageSize = 20, immediate = true } = options

  const loading = ref(false)
  const list = ref([])
  const total = ref(0)
  /** 表格勾选中的行 */
  const selection = ref([])

  const query = reactive({
    pageNo: 1,
    pageSize,
    keyword: '',
    ...initialQuery
  })

  const selectedCount = computed(() => selection.value.length)
  const selectedIds = computed(() => selection.value.map((r) => r.id))

  async function load() {
    loading.value = true
    try {
      const data = await fetcher({ ...query })
      // 兼容后端可能返回 null 的情况
      list.value = data?.list || []
      total.value = data?.total || 0
      // 删除末页最后一条后当前页会空掉，回退一页重查
      if (!list.value.length && query.pageNo > 1) {
        query.pageNo -= 1
        return load()
      }
    } catch (e) {
      console.error('[useTable] 加载失败', e)
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 改了查询条件（筛选、搜索）后回到第一页再查 */
  function reload() {
    query.pageNo = 1
    return load()
  }

  function handlePageChange(pageNo) {
    query.pageNo = pageNo
    return load()
  }

  function handleSizeChange(size) {
    query.pageSize = size
    query.pageNo = 1
    return load()
  }

  function handleSelectionChange(rows) {
    selection.value = rows
  }

  /** 表格勾选状态要手动清，否则删除后残留已删行的 id */
  function clearSelection(tableRef) {
    selection.value = []
    tableRef?.value?.clearSelection()
  }

  if (immediate) load()

  return {
    loading,
    list,
    total,
    query,
    selection,
    selectedCount,
    selectedIds,
    load,
    reload,
    handlePageChange,
    handleSizeChange,
    handleSelectionChange,
    clearSelection
  }
}
