<template>
  <!--
    角色权限

    原型上这一页是两个页签：
      权限配置 ← 左角色列表 + 右菜单树（勾选后保存）
      角色人员 ← 选中角色下的人员列表
    两个页签共用「当前选中的角色」。
  -->
  <div class="role-page">
    <div class="role-page__head">
      <h2 class="role-page__title">角色权限</h2>
      <div class="role-page__head-actions">
        <el-button size="large" @click="onCreateGroup">新增角色组</el-button>
        <el-button size="large" @click="onDeleteGroup">删除角色组</el-button>
        <el-button type="primary" size="large" @click="onAddRole">新增角色</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <!-- ---------------------------------- 权限配置 ---------------------------------- -->
      <el-tab-pane label="权限配置" name="permission">
        <div class="role-panel">
          <!-- 左：角色列表，点一行切换右侧菜单树 -->
          <el-card shadow="never" class="role-panel__aside">
            <el-table
              v-loading="roleLoading"
              :data="roleList"
              highlight-current-row
              height="560"
              @current-change="selectRole"
            >
              <el-table-column prop="name" label="角色名称" min-width="120" show-overflow-tooltip />
              <el-table-column prop="roleKey" label="角色标识" min-width="120" show-overflow-tooltip />
              <el-table-column prop="dataScope" label="数据范围" min-width="120" show-overflow-tooltip />
              <el-table-column prop="userCount" label="人数" width="70" align="center" />
              <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
              <el-table-column prop="createTime" label="创建时间" min-width="150" show-overflow-tooltip />
              <el-table-column label="操作" width="110" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" v-permission="'system:role:update'" @click.stop="onEditRole(row)">编辑</el-button>
                  <el-button link type="danger" v-permission="'system:role:delete'" @click.stop="onDeleteRole(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 右：菜单树 -->
          <el-card shadow="never" class="role-panel__main">
            <template #header>
              <div class="role-panel__main-head">
                <span>{{ currentRole ? `${currentRole.name} — 菜单权限` : '请先选择左侧角色' }}</span>
                <el-button
                  type="primary"
                  :disabled="!currentRole"
                  :loading="saving"
                  @click="onSavePermissions"
                >
                  保存
                </el-button>
              </div>
            </template>

            <el-tree
              ref="menuTreeRef"
              v-loading="menuLoading"
              :data="menuTree"
              node-key="menuId"
              show-checkbox
              default-expand-all
              :props="{ label: 'menuName', children: 'children' }"
              class="role-panel__tree"
            />
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ---------------------------------- 角色人员 ---------------------------------- -->
      <el-tab-pane label="角色人员" name="user" lazy>
        <p class="role-panel__tip">
          {{ currentRole ? `当前角色：${currentRole.name}` : '请先在「权限配置」页签选择角色' }}
        </p>
        <pro-list
          ref="userListRef"
          :key="currentRole?.id || 'none'"
          title="角色人员"
          :fetcher="fetchRoleUsers"
          :columns="userColumns"
          :filters="[]"
          :toolbar="USER_TOOLBAR"
          search-placeholder="姓名/手机号码"
          :starrable="false"
          @action="onUserAction"
        >
          <template #filter-right>
            <el-button @click="onAssignUsers">选择角色人员</el-button>
          </template>
        </pro-list>
      </el-tab-pane>
    </el-tabs>

    <config-form-dialog
      v-model="visible"
      :title="title"
      :fields="FIELDS"
      :model="form"
      :submitting="submitting"
      width="640px"
      @submit="submit"
    />

    <config-form-dialog
      v-model="groupVisible"
      :title="groupTitle"
      :fields="GROUP_FIELDS"
      :model="groupForm"
      :submitting="groupSubmitting"
      width="520px"
      @submit="submitGroup"
    />

    <!-- 选择角色人员（多选）与删除角色组（先选一个）都复用通用选择器 -->
    <entity-selector-dialog
      v-model="assignVisible"
      selector-key="roleUser"
      @confirm="onAssignConfirm"
    />
    <entity-selector-dialog
      v-model="groupPickVisible"
      selector-key="roleGroup"
      @confirm="onGroupPickConfirm"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import EntitySelectorDialog from '@/components/form/EntitySelectorDialog.vue'
import {
  getRolePage,
  getMenuTree,
  getRolePermissions,
  saveRolePermissions,
  getRoleUsers,
  removeRoleUsers,
  createRole,
  updateRole,
  deleteRole,
  createRoleGroup,
  deleteRoleGroup,
  assignRoleUsers
} from '@/api/system'
import { useFormDialog } from '@/composables/useFormDialog'
import { DATA_SCOPE_OPTIONS, DATA_SCOPE_CUSTOM } from '@/constants/options'

const activeTab = ref('permission')

const roleLoading = ref(false)
const roleList = ref([])
const currentRole = ref(null)

const menuLoading = ref(false)
const menuTree = ref([])
const menuTreeRef = ref(null)
const saving = ref(false)

const userListRef = ref(null)

/** 角色人员列：原型上这一页只有 8 列，没有状态列 */
const userColumns = [
  { prop: 'name', label: '姓名', minWidth: 100, link: true },
  { prop: 'username', label: '工号（登陆账号）', minWidth: 130 },
  { prop: 'gender', label: '性别', minWidth: 80 },
  { prop: 'phone', label: '手机号码', minWidth: 140 },
  { prop: 'email', label: '联系邮箱', minWidth: 160 },
  { prop: 'deptName', label: '所属部门', minWidth: 120 }
]

const USER_TOOLBAR = [{ key: 'remove', label: '移除' }]

async function loadRoles() {
  roleLoading.value = true
  try {
    const data = await getRolePage({ pageNo: 1, pageSize: 100 })
    roleList.value = data?.list || []
    if (roleList.value.length) currentRole.value = roleList.value[0]
  } finally {
    roleLoading.value = false
  }
}

async function loadMenus() {
  menuLoading.value = true
  try {
    const data = await getMenuTree()
    menuTree.value = Array.isArray(data) ? data : data?.list || []
  } finally {
    menuLoading.value = false
  }
}

/** 切换角色：拉该角色已勾选的菜单 ID 回填到树上 */
async function loadPermissions() {
  // 先取快照。⚠️ 这两个引用必须在 await **之后**重新校验，见下。
  const role = currentRole.value
  const tree = menuTreeRef.value
  // 没选角色、或树还没渲染出来（树在 v-if 之后）—— 直接跳过
  if (!role || !tree) return

  const ids = await getRolePermissions(role.id)

  // ⚠️ await 之后必须【重新校验】，不能只靠上面那次判空 —— 这是一个真实的崩溃点：
  //
  //    · 树可能在等待期间被 v-if 卸载（**切换页签就会**），此时原来的
  //      `menuTreeRef.value` 已经变成 null，再调 setCheckedKeys 会抛
  //      「Cannot read properties of null (reading 'setCheckedKeys')」。
  //      这个函数是 async 且被无 await 调用（onMounted / watch 里），
  //      所以它是**未捕获的 promise rejection** —— 控制台只报
  //      `Uncaught (in promise)`，不影响别处，但渲染流程被打断。
  //    · 角色也可能在等待期间被切换。把旧角色的勾选结果写到新角色上更糟 ——
  //      那会让管理员以为自己看到的是新角色的权限。
  if (menuTreeRef.value !== tree || currentRole.value !== role) return

  // 只设叶子节点，父节点由 el-tree 自己算半选，避免父节点被整枝勾死
  tree.setCheckedKeys(Array.isArray(ids) ? ids : [])
}

function selectRole(row) {
  currentRole.value = row
}

onMounted(async () => {
  await Promise.all([loadRoles(), loadMenus()])
  loadPermissions()
})

// 树是 v-if 之后才有的，页签切回来时补一次回填
watch(activeTab, (tab) => {
  if (tab === 'permission') loadPermissions()
})

/** 角色人员列表要按当前角色取数 */
function fetchRoleUsers(query) {
  if (!currentRole.value) return Promise.resolve({ list: [], total: 0 })
  return getRoleUsers(currentRole.value.id, query)
}

async function onSavePermissions() {
  const tree = menuTreeRef.value
  // 没选角色、或树还没渲染出来（树在 v-if 之后）—— 无事可做。
  // ⚠️ 与 loadPermissions 同一类防线：树可能在任何时刻是 null，别直接取它的方法。
  if (!currentRole.value || !tree) return
  const menuIds = [...tree.getCheckedKeys(), ...tree.getHalfCheckedKeys()]
  saving.value = true
  try {
    await saveRolePermissions(currentRole.value.id, menuIds)
    ElMessage.success('权限保存成功')
  } finally {
    saving.value = false
  }
}

/**
 * 角色表单字段
 *
 * 「自定义数据范围」只在数据范围选了「自定义」时才出现 ——
 * 《02-建表文档》3.3 明确：仅 data_scope = 自定义 时 sys_role_dept 才生效。
 * 用字段的 visible 函数表达，隐藏时 el-form 也不校验它。
 */
const FIELDS = [
  { prop: 'name', label: '角色名称', type: 'input', required: true, maxlength: 64 },
  {
    prop: 'roleKey',
    label: '角色标识',
    type: 'input',
    required: true,
    maxlength: 64,
    placeholder: '如：sales',
    // 权限判断用的字符串，改了会让已有的权限配置失效，所以编辑时不给改
    disabled: (model) => !!model.id,
    tip: '程序里判断权限用的字符串，唯一且建成后不可修改'
  },
  {
    prop: 'dataScope',
    label: '数据范围',
    type: 'select',
    options: DATA_SCOPE_OPTIONS,
    required: true
  },
  {
    prop: 'deptIds',
    label: '自定义部门',
    type: 'deptTree',
    multiple: true,
    span: 24,
    visible: (model) => model.dataScope === DATA_SCOPE_CUSTOM
  },
  {
    // ⚠️ 与「角色」那栏同一套写法：prop 放【名称】用于回填显示，
    //    extraProp 接选择器写回的【id】。这里就是 groupName / groupId。
    // ⚠️ 角色组只是分组标签，不影响权限判定 —— 选不选都行，清空 = 未分组
    prop: 'groupName',
    label: '所属角色组',
    type: 'selector',
    selector: 'roleGroup',
    extraProp: 'groupId'
  },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 255 }
]

const {
  visible, form, title, submitting,
  openAdd, openEdit, submit
} = useFormDialog({
  label: '角色',
  // ⚠️ groupName / groupId 这对：前者是下拉回填【显示】用的名称，后者是提交给后端的【真实值】
  //    （选择器把选中项的 id 写到 extraProp = groupId）。角色组只是分组标签，不影响权限判定。
  //
  // ⚠️ 注意：emptyForm 的各个键之间【不能夹注释】—— 哪怕行尾注释也不行。
  //    `npm run check:static` 靠 `(?:^|[,{])\s*(\w+)\s*:` 提取键名，
  //    它要求逗号/花括号后面只有空白紧接键名；注释一插进去，后面那个键就提取不到，
  //    会误报「emptyForm 缺 xxx」。要写说明就写在这个对象【外面】。
  emptyForm: () => ({
    name: '',
    roleKey: '',
    dataScope: '仅本人',
    deptIds: [],
    groupName: '',
    groupId: null,
    remark: ''
  }),
  create: createRole,
  update: updateRole,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    loadRoles()
  }
})

/** 角色组表单。原型上这一页只有名称和备注两个字段 */
const GROUP_FIELDS = [
  { prop: 'name', label: '角色组名称', type: 'input', required: true, maxlength: 64, span: 24 },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 255 }
]

const {
  visible: groupVisible,
  form: groupForm,
  title: groupTitle,
  submitting: groupSubmitting,
  openAdd: openGroupAdd,
  submit: submitGroup
} = useFormDialog({
  label: '角色组',
  emptyForm: () => ({ name: '', remark: '' }),
  create: createRoleGroup,
  onSuccess: () => ElMessage.success('新增成功')
})

function onAddRole() {
  openAdd()
}

/** 编辑角色 —— roleKey 是程序里判断权限用的字符串，建成后不给改 */
function onEditRole(row) {
  openEdit(row)
}

async function onDeleteRole(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除角色「${row.name}」吗？删除后该角色下的人员会失去对应权限。`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  await deleteRole(row.id)
  ElMessage.success('删除成功')
  // 删掉的若是当前选中角色，右侧菜单树要跟着清空
  if (currentRole.value?.id === row.id) {
    currentRole.value = null
    menuTreeRef.value?.setCheckedKeys([])
  }
  await loadRoles()
}

function onCreateGroup() {
  openGroupAdd()
}

// —— 删除角色组：先弹选择器选一个，再确认 ——
const groupPickVisible = ref(false)

function onDeleteGroup() {
  groupPickVisible.value = true
}

async function onGroupPickConfirm(rows) {
  const group = rows[0]
  try {
    await ElMessageBox.confirm(`确定删除角色组「${group.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await deleteRoleGroup(group.id)
  ElMessage.success('删除成功')
}

/**
 * 选择角色人员
 *
 * 原来这里只能选「人」，但选择器返回的是用户列表；分配完要刷新角色人员列表，
 * 否则用户以为没生效。
 */
const assignVisible = ref(false)

function onAssignUsers() {
  if (!currentRole.value) return ElMessage.warning('请先在「权限配置」页签选择角色')
  assignVisible.value = true
}

async function onAssignConfirm(rows) {
  const userIds = rows.map((r) => r.id)
  await assignRoleUsers(currentRole.value.id, userIds)
  ElMessage.success(`已添加 ${userIds.length} 人到「${currentRole.value.name}」`)
  // 人数列在左侧角色表里，两边都要刷
  loadRoles()
  if (activeTab.value === 'user') userListRef.value?.reload()
}

async function onUserAction({ key, ids, clear }) {
  if (key !== 'remove') return
  if (!currentRole.value) return
  try {
    await ElMessageBox.confirm(`确定把选中的 ${ids.length} 人移出该角色吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await removeRoleUsers(currentRole.value.id, ids)
  ElMessage.success('移除成功')
  clear()
  userListRef.value?.reload()
}
</script>

<style scoped lang="scss">
.role-page__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.role-page__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.role-page__head-actions {
  display: flex;
  gap: 8px;
}

.role-panel {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  &__aside {
    width: 620px;
    flex: none;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__main-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__tree {
    max-height: 500px;
    overflow: auto;
  }

  &__tip {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--crm-text-secondary);
  }
}
</style>
