<template>
  <pro-list
    ref="listRef"
    title="计量单位"
    add-text="新增单位"
    :fetcher="getUnitPage"
    :columns="columns"
    :filters="[]"
    :toolbar="TOOLBAR"
    :starrable="false"
    search-placeholder="计量单位"
    @add="onAdd"
    @action="onAction"
  />

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    @submit="submit"
  />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import { getUnitPage, deleteUnit, createUnit, updateUnit } from '@/api/system'
import { useFormDialog } from '@/composables/useFormDialog'

const listRef = ref(null)

/** prop 与 mock/db.js 的 unit 一致 */
const columns = [
  { prop: 'name', label: '计量单位', minWidth: 120, link: true },
  { prop: 'creator', label: '创建人', minWidth: 120 },
  { prop: 'createTime', label: '创建时间', minWidth: 170 }
]

const TOOLBAR = [
  { key: 'edit', perm: 'system:unit:update', label: '编辑' },
  { key: 'delete', perm: 'system:unit:delete', label: '删除' }
]

/**
 * 表单字段
 *
 * 字段名必须与上面 columns 的 prop 一致 —— 否则新增完那行在列表里全是「--」。
 *
 * ⚠️ 这里刻意**没有**「备注说明」：`sys_unit` 表没有 remark 列，
 * 留着它等于让用户填一个必然被后端静默丢弃的字段。等表加上该列时，
 * FIELDS 与 columns 各补一行即可。
 */
const FIELDS = [
  {
    prop: 'name',
    label: '计量单位',
    type: 'input',
    span: 24,
    required: true,
    maxlength: 32,
    placeholder: '如：台 / 个 / 箱'
  }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '计量单位',
  width: '520px',
  emptyForm: () => ({ name: '' }),
  create: createUnit,
  update: updateUnit,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

function onAdd() {
  openAdd()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    // 列表行里的字段已经够表单用，不必再调详情接口
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 个计量单位吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteUnit(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
  }
}
</script>
