<template>
  <!--
    产品

    与客户/商机等页不同，原型的「产品」页表格没有「关注」星标列，
    所以这里显式关掉（ProList 的 starrable 默认是 true）。
  -->
  <pro-list
    ref="listRef"
    title="产品"
    add-text="新增产品"
    :fetcher="getProductPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="产品名称/产品编码"
    :starrable="false"
    detail-path="/crm/product/:id"
    @add="onAdd"
    @action="onAction"
  >
    <!-- 是否上架：配色与产品详情页同源（constants/statusTags.js 的 shelfTagType） -->
    <template #cell-onShelf="{ value }">
      <el-tag :type="shelfTagType(value)" effect="plain" size="small">
        {{ value ? '上架' : '下架' }}
      </el-tag>
    </template>

    <!-- 产品图片：表单里上传后拿到的是 OSS 公网 URL（bucket 公共读），有图才渲染缩略图 -->
    <template #cell-imageUrl="{ value }">
      <el-image
        v-if="value"
        :src="value"
        :preview-src-list="[value]"
        preview-teleported
        fit="cover"
        class="product__image"
      />
      <span v-else>--</span>
    </template>

    <!-- 税率：库里是 DECIMAL(5,2)（如 6.00），界面上补个 % 更好读；空值兜底成 -- -->
    <template #cell-taxRate="{ value }">
      {{ value === null || value === undefined || value === '' ? '--' : `${value}%` }}
    </template>

    <template #filter-right>

      <el-button @click="onExport">导出</el-button>

      <el-button @click="onAdvancedFilter">高级筛选</el-button>

    </template>

  </pro-list>

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="720px"
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
import { exportNameOf } from '@/utils/exportName'
import {
  getProductPage,
  deleteProduct,
  onShelfProduct,
  offShelfProduct,
  exportProduct,
  createProduct,
  updateProduct
} from '@/api/product'
import { useFormDialog } from '@/composables/useFormDialog'
import { ensureUnitOptions, unitOptions } from '@/composables/useUnitOptions'
import { shelfTagType } from '@/constants/statusTags'

const listRef = ref(null)

/**
 * 表格列
 *
 * 顺序与宽度取自原型「产品」页的表头（按元件绝对坐标的 left 升序提取）。
 * 一律用 minWidth，让表格自适应内容区宽度。
 *
 * 成本价对非授权角色后端会置 null（接口文档 1.7），ProList 的金额列已兜底成 --。
 */
const columns = [
  { prop: 'name', label: '产品名称', minWidth: 148, link: true },
  { prop: 'code', label: '产品编码', minWidth: 173 },
  { prop: 'categoryName', label: '产品类型', minWidth: 118 },
  { prop: 'unitName', label: '单位', minWidth: 148 },
  { prop: 'costPrice', label: '成本价', minWidth: 162, money: true },
  { prop: 'salePrice', label: '建议销售价', minWidth: 148, money: true },
  // ⚠️ 「税率(%)」是对原型 11 列表头的**自愿偏离**（插在建议销售价右侧）：
  //    没有这一列，用户在列表里看不到产品维护了什么税率，只能逐个点开编辑，
  //    而税率又是报价单明细的默认值来源。理由与报价单页「关联合同」列同一性质。
  { prop: 'taxRate', label: '税率(%)', minWidth: 100 },
  { prop: 'onShelf', label: '是否上架销售', minWidth: 118 },
  { prop: 'description', label: '产品描述', minWidth: 142 },
  { prop: 'imageUrl', label: '产品图片', minWidth: 141 },
  { prop: 'creator', label: '创建人', minWidth: 115 },
  { prop: 'createTime', label: '创建时间', minWidth: 206 }
]

/** 原型筛选胶囊：全部 / 已上架 / 未上架 */
const FILTERS = [
  { label: '全部产品', value: 'all' },
  { label: '已上架', value: 'onShelf' },
  { label: '未上架', value: 'offShelf' }
]

/** 原型产品页的批量按钮：编辑 / 删除 / 上架 / 下架 */
const TOOLBAR = [
  { key: 'edit', perm: 'crm:product:update', label: '编辑' },
  { key: 'delete', perm: 'crm:product:delete', label: '删除' },
  { key: 'onShelf', perm: 'crm:product:onShelf', label: '上架' },
  { key: 'offShelf', perm: 'crm:product:offShelf', label: '下架' }
]

async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportProduct({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '产品')
    exportVisible.value = true
  } catch {
    // mock 模式下会提示「接口尚未实现」；真实环境的失败提示由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

function onDownloaded() {
  ElMessage.success('下载完成')
}

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

/**
 * 新增/编辑表单字段
 *
 * 产品编码这一项：《建表文档》3.2 说它由编号规则引擎生成，前端应为只读。
 * 但编号引擎还没实现，所以这里先放开可填（`tip` 里说明），
 * 引擎就绪后改成 `type: 'readonly'`。
 */
const FIELDS = [
  {
    prop: 'name',
    label: '产品名称',
    type: 'input',
    required: true,
    maxlength: 128
  },
  {
    prop: 'code',
    label: '产品编码',
    type: 'input',
    required: true,
    maxlength: 64,
    placeholder: '如：CP0001',
    tip: '编号规则引擎就绪后改由后端生成'
  },
  {
    prop: 'categoryName',
    label: '产品类型',
    type: 'selector',
    selector: 'productCategory',
    extraProp: 'categoryId'
  },
  // 单位选项来自 GET /system/unit/simple-list（原来硬编码 8 个，其中 5 个库里没有 → 一选就报 2408）
  { prop: 'unitName', label: '单位', type: 'select', options: () => unitOptions.value },
  { prop: 'salePrice', label: '建议销售价', type: 'number', precision: 2, step: 10 },
  {
    prop: 'costPrice',
    label: '成本价',
    type: 'number',
    precision: 2,
    step: 10,
    tip: '非授权角色看不到这个字段（后端字段权限会置空）'
  },
  // 税率：产品上维护的税率会写进报价单/合同明细行的 tax_rate 快照（选产品时自动带出）。
  // 范围与后端 ProductSaveReqVO 的 @DecimalMin(0) / @DecimalMax(100) / 2 位小数对齐；
  // 默认 0 与 DDL 的 `tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00` 一致。
  {
    prop: 'taxRate',
    label: '税率(%)',
    type: 'number',
    min: 0,
    max: 100,
    precision: 2,
    step: 1,
    tip: '写入报价单/合同明细行的税率，选产品时自动带出'
  },
  {
    prop: 'onShelf',
    label: '是否上架销售',
    type: 'switch',
    activeValue: true,
    inactiveValue: false
  },
  // 产品图片：单图，上传后把 OSS URL 写进 imageUrl（控件见 components/form/ProductImageUpload.vue）
  { prop: 'imageUrl', label: '产品图片', type: 'imageUpload', span: 24 },
  { prop: 'description', label: '产品描述', type: 'textarea', span: 24, maxlength: 500 }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '产品',
  // ⚠️ 这里的键必须与 FIELDS 的 prop 一一对应：useFormDialog 只提交 emptyForm 声明过的键
  //    （useFormDialog.js 的 pickFormFields），漏一个就是「表单项看得见、存不进去、编辑也回填不上」。
  // ⚠️ 而且**别把注释写进下面这个对象字面量里** —— check:static 第 10 项靠
  //    `[,{]\s*键:` 从源码里抽键名，中间夹注释会让它抽不到，于是误报「emptyForm 缺 xx」。
  emptyForm: () => ({
    name: '',
    code: '',
    categoryName: '',
    categoryId: null,
    unitName: '',
    salePrice: 0,
    costPrice: 0,
    taxRate: 0,
    onShelf: false,
    imageUrl: '',
    description: ''
  }),
  create: createProduct,
  update: updateProduct,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

// 进页面就预取单位选项：点「新增」时下拉里已经有数据，不会先空一下
ensureUnitOptions()

function onAdd() {
  openAdd()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 个产品吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteProduct(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  // 上架 / 下架：批量状态变更，同样先确认
  if (key === 'onShelf' || key === 'offShelf') {
    const isOn = key === 'onShelf'
    try {
      await ElMessageBox.confirm(
        `确定${isOn ? '上架' : '下架'}选中的 ${ids.length} 个产品吗？`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    const api = isOn ? onShelfProduct : offShelfProduct
    await Promise.all(ids.map((id) => api(id)))
    ElMessage.success(isOn ? '上架成功' : '下架成功')
    clear()
    listRef.value?.reload()
  }
}
</script>

<style scoped lang="scss">
.product__image {
  width: 40px;
  height: 40px;
  vertical-align: middle;
}
</style>
