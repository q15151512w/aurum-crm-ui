<template>
  <!--
    产品类型

    原型上这一页没有搜索框，也没有「显示：」筛选胶囊，
    所以 ProList 的 filters 传空数组、searchable 传 false。
    列表也没有分页（分类一次全量返回），靠 ProList 默认那一页分页兜住。
  -->
  <pro-list
    ref="listRef"
    title="产品类型"
    add-text="新增类型"
    :fetcher="getProductCategoryTree"
    :columns="columns"
    :filters="[]"
    :searchable="false"
    :starrable="false"
    :toolbar="TOOLBAR"
    @add="onAdd"
    @action="onAction"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
    </template>
  </pro-list>

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    @submit="submit"
  />

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { getProductCategoryTree, deleteProductCategory, exportProductCategory, createProductCategory, updateProductCategory } from '@/api/product'
import { useFormDialog } from '@/composables/useFormDialog'

const listRef = ref(null)

/**
 * 表格列
 *
 * 顺序与宽度取自原型「产品类型」页的表头（按元件绝对坐标的 left 升序提取）。
 * 一律用 minWidth，让表格自适应内容区宽度。
 */
const columns = [
  // 原型这几列等宽铺满整行（各 323px），但那是 1920 画布下的值。
  // 这里给较小的 minWidth 让表格自适应，窄屏也不会挤爆。
  { prop: 'name', label: '类型名称', minWidth: 180, link: true },
  { prop: 'code', label: '类型编号', minWidth: 160 },
  { prop: 'remark', label: '备注', minWidth: 180 },
  { prop: 'creator', label: '创建人', minWidth: 120 },
  { prop: 'createTime', label: '创建时间', minWidth: 170 }
]

/** 原型产品类型页的批量按钮：编辑 / 删除 */
const TOOLBAR = [
  { key: 'edit', perm: 'crm:productCategory:update', label: '编辑' },
  { key: 'delete', perm: 'crm:productCategory:delete', label: '删除' }
]

const FIELDS = [
  {
    prop: 'name',
    label: '类型名称',
    type: 'input',
    span: 24,
    required: true,
    maxlength: 64,
    placeholder: '如：手机数码 / 电脑办公'
  },
  {
    prop: 'code',
    label: '类型编号',
    type: 'input',
    span: 24,
    required: true,
    maxlength: 32,
    placeholder: '如：LX001',
    tip: '编号规则引擎就绪后改由后端生成'
  },
  {
    prop: 'remark',
    label: '备注',
    type: 'textarea',
    span: 24,
    maxlength: 255,
    placeholder: '选填'
  }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '产品类型',
  width: '520px',
  emptyForm: () => ({ name: '', code: '', remark: '' }),
  create: createProductCategory,
  update: updateProductCategory,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

function onAdd() {
  openAdd()
}

async function onExport() {
  try {
    const url = await exportProductCategory({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '产品类型导出'
    exportVisible.value = true
  } catch {
    // mock 模式下会提示「接口尚未实现」，真实环境的失败提示由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

function onDownloaded() {
  ElMessage.success('下载完成')
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 个产品类型吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteProductCategory(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
  }
}
</script>
