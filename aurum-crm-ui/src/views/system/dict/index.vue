<template>
  <!--
    字典管理（主从结构）

    左：字典类型（有哪些字典）  右：选中类型下的字典项（每个字典有哪些值）

    原型里没有这一页，样式按其它基础数据页做的。
    后端对应《05-接口文档》3.5，`system:dict:*` 只授给了超管 —— 管理员专属页面。
  -->
  <div class="dict">
    <aside class="dict__side">
      <div class="dict__side-head">
        <span class="dict__side-title">字典类型</span>
        <el-button link type="primary" @click="openTypeAdd">
          <el-icon><Plus /></el-icon>
          新增
        </el-button>
      </div>

      <div v-loading="typeLoading" class="dict__side-list">
        <div v-if="!types.length" class="dict__tip">还没有字典类型，点右上角「新增」。</div>
        <div
          v-for="t in types"
          v-else
          :key="t.id"
          class="dict__type"
          :class="{ 'is-active': t.id === activeTypeId }"
          @click="activeTypeId = t.id"
        >
          <div class="dict__type-main">
            <div class="dict__type-name">{{ t.name }}</div>
            <div class="dict__type-code">{{ t.type }}</div>
          </div>
          <span class="dict__type-acts">
            <el-icon title="编辑" @click.stop="openTypeEdit(t)"><Edit /></el-icon>
            <el-icon title="删除" @click.stop="removeType(t)"><Delete /></el-icon>
          </span>
        </div>
      </div>
    </aside>

    <section class="dict__main">
      <!--
        :key 用 type —— 切换字典类型时强制重建 ProList，把它的分页/搜索状态重置掉。
        不加的话，从 A 类型切到 B 类型时会沿用上一次的 keyword 和页码，
        出现「切过去右边是空的」这种莫名其妙的表象。
      -->
      <pro-list
        v-if="activeType"
        :key="activeType.type"
        ref="itemListRef"
        :title="`字典项：${activeType.name}`"
        add-text="新增字典项"
        :fetcher="fetchItems"
        :columns="ITEM_COLUMNS"
        :filters="[]"
        :toolbar="ITEM_TOOLBAR"
        :starrable="false"
        search-placeholder="标签 / 键值"
        @add="openItemAdd"
        @action="onItemAction"
      >
        <template #cell-status="{ value }">
          <el-tag :type="value === '正常' ? 'success' : 'danger'" effect="plain" size="small">
            {{ value }}
          </el-tag>
        </template>
        <template #cell-isDefault="{ value }">
          <el-tag v-if="value" type="info" effect="plain" size="small">默认</el-tag>
          <span v-else>--</span>
        </template>
      </pro-list>

      <el-empty v-else description="请先在左侧选择一个字典类型" />
    </section>
  </div>

  <config-form-dialog
    v-model="typeVisible"
    :title="typeTitle"
    :fields="TYPE_FIELDS"
    :model="typeForm"
    :submitting="typeSubmitting"
    width="560px"
    @submit="submitType"
  />

  <config-form-dialog
    v-model="itemVisible"
    :title="itemTitle"
    :fields="ITEM_FIELDS"
    :model="itemForm"
    :submitting="itemSubmitting"
    width="560px"
    @submit="submitItem"
  />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import {
  getDictTypePage, createDictType, updateDictType, deleteDictType,
  getDictData, createDictData, updateDictData, deleteDictData
} from '@/api/system'
import { useFormDialog } from '@/composables/useFormDialog'

const types = ref([])
const typeLoading = ref(false)
const activeTypeId = ref(null)
const itemListRef = ref(null)

const activeType = computed(() => types.value.find((t) => t.id === activeTypeId.value) || null)

const ITEM_COLUMNS = [
  { prop: 'label', label: '字典标签', minWidth: 140 },
  { prop: 'value', label: '字典键值', minWidth: 100 },
  { prop: 'sort', label: '排序', minWidth: 80 },
  { prop: 'status', label: '状态', minWidth: 90 },
  { prop: 'isDefault', label: '默认', minWidth: 80 },
  { prop: 'remark', label: '备注', minWidth: 140 }
]

const ITEM_TOOLBAR = [
  { key: 'edit', perm: 'system:dict:update', label: '编辑' },
  { key: 'delete', perm: 'system:dict:delete', label: '删除' }
]

/**
 * 字典项取数：把当前选中的字典类型拼进去。
 *
 * ProList 传进来的是它自己的查询条件（pageNo / pageSize / keyword），
 * 这里补上 dictType 再交给 api 层。
 */
function fetchItems(params) {
  return getDictData({ ...params, dictType: activeType.value?.type })
}

async function loadTypes() {
  typeLoading.value = true
  try {
    // 字典类型是低频、量少（种子 11 个）的配置数据，一次拉完不做分页
    const data = await getDictTypePage({ pageNo: 1, pageSize: 100 })
    types.value = data?.list || []
    // 保持当前选中项；它被删掉或首次进入时，默认选第一个
    if (!types.value.some((t) => t.id === activeTypeId.value)) {
      activeTypeId.value = types.value[0]?.id ?? null
    }
  } catch {
    types.value = []
  } finally {
    typeLoading.value = false
  }
}

// ---------------- 字典类型：表单 + 弹窗 ----------------

const TYPE_FIELDS = [
  { prop: 'name', label: '字典名称', type: 'input', required: true, maxlength: 100 },
  {
    prop: 'type',
    label: '字典类型',
    type: 'input',
    required: true,
    maxlength: 100,
    placeholder: '如：crm_source',
    // 编码是程序里取字典的 key，建成后业务代码就在引用它了 —— 编辑时不给改
    disabled: (model) => !!model.id,
    tip: '程序取值用的标识，建成后不可修改'
  },
  {
    prop: 'status',
    label: '状态',
    type: 'radio',
    options: [
      { label: '正常', value: '正常' },
      { label: '停用', value: '停用' }
    ]
  },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 255 }
]

const {
  visible: typeVisible,
  form: typeForm,
  title: typeTitle,
  submitting: typeSubmitting,
  openAdd: openTypeAddDialog,
  openEdit: openTypeEditDialog,
  submit: submitType
} = useFormDialog({
  label: '字典类型',
  emptyForm: () => ({ name: '', type: '', status: '正常', remark: '' }),
  create: createDictType,
  update: updateDictType,
  onSuccess: async (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    await loadTypes()
  }
})

function openTypeAdd() {
  openTypeAddDialog()
}

function openTypeEdit(row) {
  openTypeEditDialog(row)
}

async function removeType(t) {
  try {
    await ElMessageBox.confirm(
      `确定删除字典类型「${t.name}」吗？它下面还有字典项时会删不掉。`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  await deleteDictType(t.id)
  ElMessage.success('删除成功')
  await loadTypes()
}

// ---------------- 字典项：表单 + 弹窗 ----------------

const ITEM_FIELDS = [
  {
    prop: 'dictType',
    label: '所属字典',
    type: 'readonly',
    tip: '字典项不允许换到别的字典下，需要的话请删掉重建'
  },
  { prop: 'label', label: '字典标签', type: 'input', required: true, maxlength: 100 },
  {
    prop: 'value',
    label: '字典键值',
    type: 'input',
    required: true,
    maxlength: 100,
    tip: '业务表里存的码值，字符串形式（如 1）'
  },
  { prop: 'sort', label: '排序', type: 'number', min: 0 },
  {
    prop: 'status',
    label: '状态',
    type: 'radio',
    options: [
      { label: '正常', value: '正常' },
      { label: '停用', value: '停用' }
    ]
  },
  { prop: 'isDefault', label: '默认项', type: 'switch' },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 255 }
]

const {
  visible: itemVisible,
  form: itemForm,
  title: itemTitle,
  submitting: itemSubmitting,
  openAdd: openItemAddDialog,
  openEdit: openItemEditDialog,
  submit: submitItem
} = useFormDialog({
  label: '字典项',
  emptyForm: () => ({
    dictType: activeType.value?.type ?? '',
    label: '',
    value: '',
    sort: 0,
    status: '正常',
    isDefault: false,
    remark: ''
  }),
  create: createDictData,
  update: updateDictData,
  onSuccess: async (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    itemListRef.value?.clearSelection()
    itemListRef.value?.reload()
  }
})

function openItemAdd() {
  openItemAddDialog()
}

/**
 * 编辑字典项
 *
 * ⚠️ 后端返回的字段叫 `type`，而提交时的字段叫 `dictType`（与保存 DTO 对齐）。
 *    useFormDialog 是按 emptyForm 的键回填的，键名对不上就会静默丢值 ——
 *    这里显式补一次映射，而不是把两边字段名凑巧写成一样就完事。
 */
function openItemEdit(row) {
  openItemEditDialog({ ...row, dictType: row.type })
}

async function onItemAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openItemEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 个字典项吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteDictData(id)))
    ElMessage.success('删除成功')
    clear()
    itemListRef.value?.reload()
  }
}

onMounted(loadTypes)
</script>

<style scoped lang="scss">
.dict {
  display: flex;
  gap: 16px;
  align-items: stretch;
  min-height: 420px;
}

.dict__side {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
}

.dict__side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.dict__side-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--crm-text-primary, #303133);
}

.dict__side-list {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
}

.dict__tip {
  padding: 12px 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--crm-text-secondary, #909399);
}

.dict__type {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #f5f7fa;

    .dict__type-acts {
      visibility: visible;
    }
  }

  &.is-active {
    background: #f2f7ff;
  }
}

.dict__type-main {
  flex: 1;
  min-width: 0;
}

.dict__type-name {
  font-size: 13px;
  color: var(--crm-text-primary, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dict__type-code {
  margin-top: 2px;
  font-size: 12px;
  color: var(--crm-text-secondary, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 操作图标平时藏起来，鼠标移上去才出现 —— 列表窄，常驻会挤掉类型名
.dict__type-acts {
  flex-shrink: 0;
  visibility: hidden;
  display: flex;
  gap: 8px;
  color: #909399;

  .el-icon:hover {
    color: var(--crm-primary, #2c6ddb);
  }
}

.dict__main {
  flex: 1;
  min-width: 0;
}
</style>
