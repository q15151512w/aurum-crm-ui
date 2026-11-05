<template>
  <!--
    配置驱动的列表页

    原型上所有列表页是同一个模板：
      页标题 + 新增按钮  →  搜索框 + 显示：胶囊 + 导出/高级筛选
      →  已选 N 项 + 批量按钮  →  表格  →  分页

    差异只有「列、筛选项、批量按钮、接口」四项，所以做成配置驱动的组件，
    各业务页面只写配置，不再重复写表格/分页/选择的样板代码。
  -->
  <div class="pro-list">
    <!-- 页头 -->
    <div class="pro-list__head">
      <h2 class="pro-list__title">{{ title }}</h2>
      <el-button v-if="addText" type="primary" size="large" @click="emit('add')">
        {{ addText }}
      </el-button>
    </div>

    <!-- 筛选行 -->
    <filter-bar
      v-model="query.scope"
      v-model:keyword="query.keyword"
      :options="filters"
      :searchable="searchable"
      :search-placeholder="searchPlaceholder"
      @search="reload"
      @update:model-value="reload"
    >
      <template #right>
        <slot name="filter-right" />
      </template>
    </filter-bar>

    <!-- 批量操作栏 -->
    <list-toolbar :count="selectedCount" :actions="toolbar" @action="onAction" />

    <!-- 表格 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="list"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column v-if="selectable" type="selection" width="54" align="center" />

      <!-- 关注列：原型上客户/线索/商机/合同/回款有，产品没有 -->
      <el-table-column v-if="starrable" width="54" align="center">
        <template #header>关注</template>
        <template #default="{ row }">
          <el-icon
            :size="16"
            :color="row.starred ? '#f5a623' : '#dcdfe6'"
            class="pro-list__star"
            @click="toggleStar(row)"
          >
            <StarFilled v-if="row.starred" />
            <Star v-else />
          </el-icon>
        </template>
      </el-table-column>

      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth || 100"
        :align="col.align || 'center'"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <!-- 业务页面可以用 cell-<prop> 插槽自定义单元格（状态标签、金额等） -->
          <slot :name="`cell-${col.prop}`" :row="row" :value="row[col.prop]">
            <span v-if="col.money" class="pro-list__money">{{ formatMoney(row[col.prop]) }}</span>
            <span v-else-if="col.link" class="crm-link" @click.stop="openDetail(row)">
              {{ dash(row[col.prop]) }}
            </span>
            <span v-else>{{ dash(row[col.prop]) }}</span>
          </slot>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        :current-page="query.pageNo"
        :page-size="query.pageSize"
        :page-sizes="[20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Star, StarFilled } from '@element-plus/icons-vue'

import FilterBar from './FilterBar.vue'
import ListToolbar from './ListToolbar.vue'
import { useTable } from '@/composables/useTable'
import { formatMoney } from '@/utils/number'

const props = defineProps({
  title: { type: String, required: true },
  /** 右上角新增按钮文案；留空则不显示 */
  addText: { type: String, default: '' },
  /** 取数函数 (query) => Promise<{ list, total }> */
  fetcher: { type: Function, required: true },
  /** [{ prop, label, width?, minWidth?, money?, link?, align? }] */
  columns: { type: Array, default: () => [] },
  /** 筛选胶囊 [{ label, value }]，空数组则不显示筛选行 */
  filters: { type: Array, default: () => [] },
  /** 批量按钮 [{ key, label, type? }] */
  toolbar: { type: Array, default: () => [] },
  searchable: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: '请输入关键字' },
  selectable: { type: Boolean, default: true },
  /** 是否显示「关注」星标列 */
  starrable: { type: Boolean, default: true },
  initialQuery: { type: Object, default: () => ({}) },
  pageSize: { type: Number, default: 20 },
  /**
   * 详情页路由模板，如 '/crm/contract/:id'。
   * 传了它，点第一列名称就跳详情；没传则提示详情页尚未实现。
   * 目前有详情页的是：线索 / 客户 / 商机 / 合同 / 报价单 / 产品 / 回款（共 7 类）。
   */
  detailPath: { type: String, default: '' }
})

const emit = defineEmits(['add', 'action', 'row-click', 'toggle-star'])

const router = useRouter()
const tableRef = ref(null)

const {
  loading, list, total, query, selection, selectedCount, selectedIds,
  reload, handlePageChange, handleSizeChange, handleSelectionChange, clearSelection
} = useTable(props.fetcher, {
  initialQuery: { scope: 'all', ...props.initialQuery },
  pageSize: props.pageSize
})

function onAction(key) {
  emit('action', { key, rows: selection.value, ids: selectedIds.value, clear: () => clearSelection(tableRef) })
}

/**
 * 关注星标：这里只把点击 emit 出去，写库由父页面接 @toggle-star 完成
 * （客户 starCustomer/unstarCustomer、线索 starLead/unstarLead）。
 *
 * ⚠️ 没有「无监听者时本地翻转」的兜底 —— 曾经注释是这么写的，代码却从来没实现过，
 *    于是所有没接监听的页面星标点了都毫无反应（线索列表就是这么坏的）。
 *    现在的取舍是：没接监听就没反应，也好过造一个「一刷新就没了、『我关注的』里也查不到」
 *    的假关注。
 */
function toggleStar(row) {
  emit('toggle-star', row)
}

/**
 * 点第一列的名称进详情
 *
 * 原型上各列表页的第一列都是蓝色链接。有详情页的 7 类（线索 / 客户 / 商机 /
 * 合同 / 报价单 / 产品 / 回款）由各页传 detail-path；其余没有 —— 那些页点名称要给个
 * 明确提示，否则用户点了没反应，会以为页面坏了。
 */
function openDetail(row) {
  if (props.detailPath) {
    router.push(props.detailPath.replace(':id', row.id))
  } else {
    ElMessage.info(`「${props.title}」的详情页尚未实现`)
  }
  emit('row-click', row)
}

/** 字段权限会把敏感字段置 null（见接口文档 1.7），统一兜底成 -- */
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/**
 * 页面通过 ref 拿到这些方法
 *   reload()          —— 增删改后重新取数
 *   clearSelection()  —— 清掉表格勾选（否则删完行以后选中态还留着已删行的 id）
 *   getQuery()        —— 取当前查询条件（导出、高级筛选调用方用）
 *   applyQuery(partial)—— 合并额外查询参数并回到第一页重查（高级筛选用）
 */
defineExpose({
  reload,
  clearSelection: () => clearSelection(tableRef),
  getQuery: () => ({ ...query }),
  applyQuery: (partial) => {
    Object.assign(query, partial || {})
    reload()
  }
})
</script>

<style scoped lang="scss">
.pro-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.pro-list__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.pro-list__star {
  cursor: pointer;
}

.pro-list__money {
  font-variant-numeric: tabular-nums;
}
</style>
