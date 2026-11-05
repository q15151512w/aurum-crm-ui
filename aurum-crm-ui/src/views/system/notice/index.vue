<template>
  <div class="notice-page">
    <el-tabs v-model="activeTab">
      <!-- 我的消息：所有登录用户可见 -->
      <el-tab-pane label="我的消息" name="mine">
        <pro-list
          ref="mineRef"
          title="我的消息"
          :fetcher="getNoticePage"
          :columns="mineColumns"
          :filters="[]"
          :toolbar="[]"
          :starrable="false"
          :selectable="false"
          search-placeholder="标题"
        >
          <template #filter-right>
            <el-button type="primary" plain @click="onReadAll">全部已读</el-button>
          </template>
          <template #cell-title="{ row }">
            <span :class="{ 'notice-title--unread': row.isRead === 0 }">{{ row.title || '--' }}</span>
          </template>
          <template #cell-isRead="{ row }">
            <el-tag v-if="row.isRead === 0" type="danger" size="small">未读</el-tag>
            <el-tag v-else type="info" size="small">已读</el-tag>
          </template>
          <template #cell-typeName="{ row }">
            <el-tag :type="typeTag(row.type)" size="small">{{ row.typeName || '通知' }}</el-tag>
          </template>
          <template #cell-actions="{ row }">
            <el-button
              v-if="row.isRead === 0"
              text
              type="primary"
              size="small"
              @click="onReadOne(row)"
            >标记已读</el-button>
          </template>
        </pro-list>
      </el-tab-pane>

      <!-- 公告/通知管理：仅管理员（有 system:notice:* 权限）可见 -->
      <el-tab-pane v-if="canManage" label="公告/通知" name="manage">
        <pro-list
          ref="manageRef"
          title="公告/通知"
          add-text="发布"
          :fetcher="getNoticeManagePage"
          :columns="manageColumns"
          :filters="[]"
          :toolbar="MANAGE_TOOLBAR"
          :starrable="false"
          search-placeholder="标题"
          @add="onAdd"
          @action="onAction"
        >
          <template #cell-title="{ row }">
            <span>{{ row.title || '--' }}</span>
          </template>
          <template #cell-typeName="{ row }">
            <el-tag :type="typeTag(row.type)" size="small">{{ row.typeName || '通知' }}</el-tag>
          </template>
          <template #cell-receiverName="{ row }">
            <span>{{ row.receiverName || '全员' }}</span>
          </template>
          <template #cell-sendTime="{ row }">
            <span>{{ row.sendTime ? String(row.sendTime).replace('T', ' ').slice(0, 16) : '--' }}</span>
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
      @submit="submit"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import {
  getNoticePage,
  getNoticeManagePage,
  markNoticeRead,
  markNoticeAllRead,
  createNotice,
  updateNotice,
  deleteNotice
} from '@/api/system'
import { useFormDialog } from '@/composables/useFormDialog'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const activeTab = ref('mine')
const mineRef = ref(null)
const manageRef = ref(null)

/** 是否有公告/通知管理权限 */
const canManage = computed(
  () =>
    userStore.hasPermission('system:notice:create') ||
    userStore.hasPermission('system:notice:update') ||
    userStore.hasPermission('system:notice:delete')
)

// ---------------------------------------------------------------------------
//  我的消息
// ---------------------------------------------------------------------------
const mineColumns = [
  { prop: 'title', label: '标题', minWidth: 220 },
  { prop: 'typeName', label: '类型', minWidth: 90 },
  { prop: 'isRead', label: '状态', width: 90 },
  { prop: 'sendTime', label: '时间', minWidth: 150 },
  { prop: 'actions', label: '操作', width: 100 }
]

async function onReadOne(row) {
  await markNoticeRead(row.id)
  ElMessage.success('已标记已读')
  mineRef.value?.reload()
}

async function onReadAll() {
  await markNoticeAllRead()
  ElMessage.success('已全部标记已读')
  mineRef.value?.reload()
}

// ---------------------------------------------------------------------------
//  公告/通知管理
// ---------------------------------------------------------------------------
const MANAGE_TOOLBAR = [
  { key: 'edit', label: '编辑' },
  { key: 'delete', label: '删除' }
]

const manageColumns = [
  { prop: 'title', label: '标题', minWidth: 220 },
  { prop: 'typeName', label: '类型', minWidth: 100 },
  { prop: 'receiverName', label: '接收人', minWidth: 110 },
  { prop: 'sendTime', label: '发送时间', minWidth: 160 }
]

const FIELDS = [
  {
    prop: 'title',
    label: '标题',
    type: 'input',
    span: 24,
    required: true,
    maxlength: 255,
    placeholder: '如：系统维护公告'
  },
  {
    prop: 'noticeType',
    label: '类型',
    type: 'radio',
    span: 24,
    required: true,
    options: [
      { label: '系统公告', value: 3 },
      { label: '公海回收提醒', value: 2 },
      { label: '任务提醒', value: 4 }
    ]
  },
  {
    prop: 'receiverName',
    label: '接收人',
    type: 'selector',
    selector: 'owner',
    extraProp: 'receiverId',
    span: 24,
    tip: '不选 = 全员可见（广播公告）；选了 = 只发给该人员'
  },
  {
    prop: 'content',
    label: '内容',
    type: 'textarea',
    span: 24,
    rows: 4,
    maxlength: 2000,
    placeholder: '选填'
  }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '公告/通知',
  width: '560px',
  emptyForm: () => ({ title: '', noticeType: 3, receiverName: '', receiverId: null, content: '' }),
  create: createNotice,
  update: updateNotice,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '发布成功' : '修改成功')
    manageRef.value?.clearSelection()
    manageRef.value?.reload()
  }
})

function onAdd() {
  openAdd()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    // receiverName 供回显，receiverId 才是提交字段
    openEdit({ ...rows[0], receiverName: rows[0].receiverName || '' })
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条公告/通知吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteNotice(id)))
    ElMessage.success('删除成功')
    clear()
    manageRef.value?.reload()
  }
}

function typeTag(type) {
  if (type === 'announcement') return 'warning'
  if (type === 'approval') return 'info'
  return 'primary'
}
</script>

<style scoped lang="scss">
.notice-title--unread {
  font-weight: 600;
}
</style>
