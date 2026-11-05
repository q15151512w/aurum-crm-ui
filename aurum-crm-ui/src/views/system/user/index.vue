<template>
  <pro-list
    ref="listRef"
    title="人员管理"
    add-text="新增人员"
    :fetcher="fetchUser"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    :starrable="false"
    search-placeholder="姓名/手机号码/部门"
    @add="onAdd"
    @action="onAction"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
    </template>

    <!-- 在职状态：离职是异常态，标红 -->
    <template #cell-workStatus="{ value }">
      <el-tag :type="value === '离职' ? 'danger' : 'success'" effect="plain" size="small">
        {{ value }}
      </el-tag>
    </template>

    <!-- 账号状态：已禁用标红 -->
    <template #cell-accountStatus="{ value }">
      <el-tag :type="value === '已激活' ? 'success' : 'danger'" effect="plain" size="small">
        {{ value }}
      </el-tag>
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

  <!-- 设置直属上级：用通用选择器选人（接口要的是 id，手打名字后端用不了）-->
  <entity-selector-dialog
    v-model="superiorVisible"
    selector-key="superior"
    @confirm="onSuperiorConfirm"
  />

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import EntitySelectorDialog from '@/components/form/EntitySelectorDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { exportNameOf } from '@/utils/exportName'
import {
  getUserPage,
  deleteUser,
  changeUserStatus,
  resetUserPassword,
  createUser,
  updateUser,
  setUserSuperior,
  exportUser
} from '@/api/system'
import { useFormDialog } from '@/composables/useFormDialog'
import { GENDER_OPTIONS, WORK_STATUS_OPTIONS, ACCOUNT_STATUS_OPTIONS } from '@/constants/options'

const listRef = ref(null)

/**
 * 表格列
 *
 * 顺序与宽度取自原型「人员管理」页的表头。
 * prop 必须与 mock/db.js 的 user 字段一致，否则整列显示 --。
 */
const columns = [
  { prop: 'name', label: '姓名', minWidth: 100, link: true },
  { prop: 'username', label: '工号（登陆账号）', minWidth: 130 },
  { prop: 'gender', label: '性别', minWidth: 80 },
  { prop: 'phone', label: '手机号码', minWidth: 140 },
  { prop: 'email', label: '联系邮箱', minWidth: 160 },
  { prop: 'deptName', label: '所属部门', minWidth: 120 },
  { prop: 'superiorName', label: '直属上级', minWidth: 110 },
  { prop: 'roleName', label: '角色', minWidth: 120 },
  { prop: 'workStatus', label: '在职状态', minWidth: 110 },
  { prop: 'accountStatus', label: '账号状态', minWidth: 110 }
]

/** 原型筛选胶囊：全部 / 已激活 / 已禁用 / 离职 */
const FILTERS = [
  { label: '全部人员', value: 'all' },
  { label: '已激活', value: 'active' },
  { label: '已禁用', value: 'disabled' },
  { label: '离职人员', value: 'resigned' }
]

/** 原型工具栏：编辑 / 删除 / 设置上级 / 激活 / 禁用 / 操作离职 / 重置密码 */
const TOOLBAR = [
  { key: 'edit', perm: 'system:user:update', label: '编辑' },
  { key: 'delete', perm: 'system:user:delete', label: '删除' },
  { key: 'superior', perm: 'system:user:update', label: '设置上级' },
  { key: 'activate', perm: 'system:user:changeStatus', label: '激活' },
  { key: 'disable', perm: 'system:user:changeStatus', label: '禁用' },
  { key: 'resign', perm: 'system:user:changeStatus', label: '操作离职' },
  { key: 'resetPwd', perm: 'system:user:resetPwd', label: '重置密码' }
]

/** 筛选胶囊 → 接口 status 参数（见接口文档 3.1：1 正常 / 2 禁用 / 3 离职） */
const SCOPE_STATUS = { active: 1, disabled: 2, resigned: 3 }

/** ProList 的筛选值放在 scope 上，这里翻译成后端要的 status */
function fetchUser(query) {
  const { scope, ...rest } = query
  const status = SCOPE_STATUS[scope]
  return getUserPage(status ? { ...rest, status } : rest)
}

/**
 * 新增/编辑表单字段
 *
 * ⚠️ 两个坑：
 *   1. 不能有名为 `status` 的字段 —— getUserPage 会把查询参数 status 翻译成
 *      accountStatus / workStatus，字段重名会被查询参数吞掉。这里用
 *      workStatus / accountStatus，与列表列一致。
 *   2. 密码「新增必填、编辑留空表示不改」靠 required 写成函数表达：
 *      编辑时回填的数据带了 id，新增时不带。
 */
const FIELDS = [
  {
    prop: 'username',
    label: '工号（登陆账号）',
    type: 'input',
    required: true,
    maxlength: 64,
    placeholder: '登录用的账号，唯一',
    // 账号是登录凭据，建好之后不给改
    disabled: (model) => !!model.id
  },
  {
    prop: 'password',
    label: '登录密码',
    type: 'password',
    required: (model) => !model.id,
    maxlength: 32,
    placeholder: '留空则不修改',
    tip: '新增必填；编辑时留空表示不改密码'
  },
  { prop: 'name', label: '姓名', type: 'input', required: true, maxlength: 64 },
  { prop: 'gender', label: '性别', type: 'radio', options: GENDER_OPTIONS },
  { prop: 'phone', label: '手机号码', type: 'input', maxlength: 32 },
  {
    prop: 'email',
    label: '联系邮箱',
    type: 'input',
    maxlength: 128,
    rules: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
  },
  {
    prop: 'deptId',
    label: '所属部门',
    type: 'deptTree',
    // 列表列显示的是 deptName，选中部门后顺带写回去
    extraProp: 'deptName'
  },
  { prop: 'roleName', label: '角色', type: 'selector', selector: 'role', extraProp: 'roleId' },
  { prop: 'workStatus', label: '在职状态', type: 'select', options: WORK_STATUS_OPTIONS },
  { prop: 'accountStatus', label: '账号状态', type: 'select', options: ACCOUNT_STATUS_OPTIONS }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '人员',
  emptyForm: () => ({
    username: '',
    password: '',
    name: '',
    gender: '男',
    phone: '',
    email: '',
    deptId: null,
    deptName: '',
    roleName: '',
    workStatus: '在职',
    accountStatus: '已激活'
  }),
  create: createUser,
  update: updateUser,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

function onAdd() {
  openAdd()
}

/** 导出人员 —— 后端返回 OSS 下载 URL，弹窗让用户选择是否下载 */
async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportUser({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '人员管理')
    exportVisible.value = true
  } catch {
    // 失败提示已由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

function onDownloaded() {
  ElMessage.success('下载完成')
}

// —— 设置直属上级 ——
// 建表文档 sys_user.superior_id；审批流的「发起人直属上级」节点靠它解析。
const superiorVisible = ref(false)
const superiorTarget = ref(null)

async function onSuperiorConfirm(selected) {
  const boss = selected[0]
  if (String(boss.id) === String(superiorTarget.value.id)) {
    return ElMessage.warning('不能把自己设为自己的上级')
  }
  await setUserSuperior(superiorTarget.value.id, boss.id, boss.name)
  ElMessage.success(`已把「${superiorTarget.value.name}」的上级设为「${boss.name}」`)
  listRef.value?.reload()
}

/** 批量改状态：激活 / 禁用 / 操作离职走的是同一个三态接口 */
async function changeStatus(ids, status, tip, clear) {
  try {
    await ElMessageBox.confirm(tip, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await Promise.all(ids.map((id) => changeUserStatus(id, status)))
  ElMessage.success('操作成功')
  clear()
  listRef.value?.reload()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 名人员吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteUser(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'activate') {
    // 「有账号必有角色」是硬约束：没有角色就激活，等于造出一个登录进去什么都看不到的
    // 幽灵账号（自助注册出来的账号就是这种）。后端也会挡，这里先拦一道给出明确指引。
    const noRole = rows.filter((r) => !r.roleName)
    if (noRole.length) {
      return ElMessage.warning(
        `「${noRole.map((r) => r.name).join('、')}」还没有分配角色，请先在「编辑」里选好角色再激活`
      )
    }
    return changeStatus(ids, 1, `确定激活选中的 ${ids.length} 名人员吗？`, clear)
  }

  if (key === 'disable') {
    return changeStatus(ids, 2, `确定禁用选中的 ${ids.length} 名人员吗？禁用后无法登录。`, clear)
  }

  if (key === 'superior') {
    if (rows.length !== 1) return ElMessage.warning('请选择一条记录设置上级')
    superiorTarget.value = rows[0]
    superiorVisible.value = true
    return
  }

  if (key === 'resign') {
    return changeStatus(ids, 3, `确定把选中的 ${ids.length} 名人员标记为离职吗？`, clear)
  }

  if (key === 'resetPwd') {
    if (rows.length !== 1) return ElMessage.warning('请选择一条记录重置密码')
    try {
      await ElMessageBox.confirm(`确定重置「${rows[0].name}」的密码吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    // 新密码由后端生成并下发，这里不传参
    await resetUserPassword(rows[0].id, {})
    ElMessage.success('密码已重置')
  }
}
</script>
