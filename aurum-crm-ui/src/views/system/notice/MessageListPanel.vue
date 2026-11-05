<template>
  <!--
    消息列表面板（内容部分，不含外层弹层/浮层容器）。

    被三处复用：
      1. 顶栏铃铛的 popover
      2. 首页「消息」区块的「查看全部」弹窗
      3. 首页「公告 | 通知」区块的「查看全部」弹窗

    规则（与用户要求一致）：点击某条 → 弹详情、并将该条标记已读、未读数减 1；
    「全部已读」→ 清空未读。已读与否由后端 isRead 字段驱动，数据源是
    GET /system/notice（含 content 与 isRead），不是看板 /dashboard/messages 的迷你字段。
  -->
  <div class="msg-panel">
    <div v-if="list.length" class="msg-panel__toolbar">
      <span class="msg-panel__count">{{ unreadTotal }} 条未读</span>
      <el-button link type="primary" size="small" @click="onMarkAll">全部已读</el-button>
    </div>

    <ul v-if="list.length" class="msg-panel__list">
      <li
        v-for="item in list"
        :key="item.id"
        class="msg-panel__item"
        :class="{ 'is-unread': item.isRead === 0 }"
        @click="onOpen(item)"
      >
        <span class="msg-panel__dot" />
        <span class="msg-panel__tag" :style="{ backgroundColor: tagColor(item.type) }">
          {{ item.typeName }}
        </span>
        <span class="msg-panel__title" :title="item.title">{{ item.title }}</span>
        <span class="msg-panel__time">{{ fmtTime(item.sendTime) }}</span>
      </li>
    </ul>

    <el-empty v-else description="暂无未读消息" :image-size="60" />

    <el-dialog
      v-model="detailVisible"
      width="560px"
      append-to-body
      destroy-on-close
      :show-close="false"
      class="notice-detail-dialog"
    >
      <div class="notice-detail">
        <!-- 头部：分类色带 + 图标 + 标题 + 时间 + 关闭 -->
        <div class="notice-detail__hero" :style="{ '--accent': accent(current?.type) }">
          <div class="notice-detail__icon">
            <el-icon :size="22"><Bell /></el-icon>
          </div>
          <div class="notice-detail__head">
            <div class="notice-detail__tag">{{ current?.typeName || '系统通知' }}</div>
            <h3 class="notice-detail__title">{{ current?.title || '消息详情' }}</h3>
          </div>
          <el-button
            text
            bg
            circle
            class="notice-detail__close"
            @click="detailVisible = false"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <!-- 正文 -->
        <div class="notice-detail__body">
          <div class="notice-detail__meta">
            <el-icon class="notice-detail__meta-ico"><Clock /></el-icon>
            <span>{{ fmtTime(current?.sendTime) || '—' }}</span>
          </div>
          <p class="notice-detail__content">{{ current?.content || '（无内容）' }}</p>
        </div>

        <!-- 底部操作区 -->
        <div class="notice-detail__foot">
          <el-button
            v-if="bizLink(current)"
            type="primary"
            round
            class="notice-detail__action"
            @click="onBizJump(current)"
          >
            去处理
            <el-icon class="el-icon--right"><Right /></el-icon>
          </el-button>
          <el-button round @click="detailVisible = false">我知道了</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, Close, Clock, Right } from '@element-plus/icons-vue'
import { markNoticeRead, markNoticeAllRead } from '@/api/system'
import { useNoticeUnread } from '@/composables/useNoticeUnread'

const props = defineProps({
  list: { type: Array, default: () => [] }
})

const emit = defineEmits(['list-change'])

const router = useRouter()
const { decrementUnread, refreshUnreadCount } = useNoticeUnread()

const detailVisible = ref(false)
const current = ref(null)

const unreadTotal = computed(() => props.list.filter((i) => i.isRead === 0).length)

const TYPE_COLORS = {
  approval: '#28d094',
  notice: '#f59a23',
  announcement: '#2c6ddb'
}
const tagColor = (type) => TYPE_COLORS[type] || '#6b778c'
const accent = (type) => TYPE_COLORS[type] || '#6b778c'

function fmtTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

/** 有可跳转的业务关联时提供「去处理」入口 */
function bizLink(row) {
  if (!row || !row.bizType || !row.bizId) return null
  // 待回访客户任务提醒 → 客户详情/列表
  if (row.bizType === 'customer') return { name: '客户' }
  return null
}

async function onOpen(item) {
  current.value = item
  detailVisible.value = true
  if (item.isRead === 0) {
    await markNoticeRead(item.id)
    item.isRead = 1 // 本地置为已读，避免二次点击重复请求
    decrementUnread(1)
  }
}

async function onMarkAll() {
  await markNoticeAllRead()
  refreshUnreadCount()
  ElMessage.success('已全部标记已读')
  emit('list-change')
}

function onBizJump(row) {
  if (row.bizType === 'customer') {
    router.push(`/crm/customer/${row.bizId}`)
  }
}
</script>

<style scoped lang="scss">
.msg-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.msg-panel__count {
  font-size: 12px;
  color: var(--crm-text-secondary);
}

.msg-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.msg-panel__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-bottom: 1px solid var(--crm-border-light);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--crm-fill-light, #f5f7fa);
  }
}

.msg-panel__dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
}

.msg-panel__item.is-unread .msg-panel__dot {
  background: var(--el-color-danger, #f56c6c);
}

.msg-panel__tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #fff;
  line-height: 18px;
}

.msg-panel__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--crm-text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-panel__item.is-unread .msg-panel__title {
  font-weight: 600;
}

.msg-panel__time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--crm-text-secondary);
}

// ---------- 消息详情弹窗（大气版） ----------
:deep(.notice-detail-dialog) {
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);

  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    padding: 0;
  }
}

.notice-detail {
  display: flex;
  flex-direction: column;
}

.notice-detail__hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 26px 26px 22px;
  color: #fff;
  overflow: hidden;
  background: var(--accent);

  &::after {
    content: '';
    position: absolute;
    right: -30px;
    top: -40px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
  }
}

.notice-detail__icon {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
}

.notice-detail__head {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
}

.notice-detail__tag {
  display: inline-block;
  padding: 2px 10px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  letter-spacing: 0.5px;
}

.notice-detail__title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-word;
}

.notice-detail__close {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  color: #fff;
  &:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.28);
  }
}

.notice-detail__body {
  padding: 24px 26px;
}

.notice-detail__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--crm-text-secondary);
}

.notice-detail__meta-ico {
  font-size: 15px;
}

.notice-detail__content {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--crm-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.notice-detail__foot {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 26px 22px;
  border-top: 1px solid var(--crm-border-light);

  .notice-detail__action {
    padding-left: 22px;
    padding-right: 22px;
  }
}
</style>
