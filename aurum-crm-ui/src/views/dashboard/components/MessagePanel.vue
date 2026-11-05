<template>
  <!--
    消息 / 公告|通知 两个区块（内容一样，标题与数据源不同）。

    默认显示父级传的摘要（list，通常 5 条）；点右上「查看全部」弹出弹窗，
    弹窗里用 MessageListPanel 呈现完整未读列表（数据源 GET /system/notice，
    带 isRead + content）。点击某条 → 弹详情、标记已读、未读数减 1；
    「全部已读」清空。规则与顶栏铃铛完全一致。

    用弹窗而非路由跳转 —— 首页就是消息的归宿，不跳页。
  -->
  <panel-card :title="title" more @more="visible = true">
    <ul class="msg">
      <li
        v-for="item in list"
        :key="item.id"
        class="msg__row"
      >
        <span class="msg__tag" :style="{ backgroundColor: tagColor(item.type) }">
          {{ item.typeName }}
        </span>
        <span class="msg__title" :title="item.title">{{ item.title }}</span>
        <span class="msg__time">{{ item.time || fmtTime(item.sendTime) }}</span>
      </li>
    </ul>

    <el-empty v-if="!list.length" description="暂无数据" :image-size="60" />

    <el-dialog
      v-model="visible"
      :title="title"
      width="520px"
      append-to-body
      destroy-on-close
      @open="loadAll"
    >
      <message-list-panel :list="fullList" @list-change="loadAll" />
    </el-dialog>
  </panel-card>
</template>

<script setup>
import { ref } from 'vue'
import PanelCard from './PanelCard.vue'
import MessageListPanel from '@/views/system/notice/MessageListPanel.vue'
import { getNoticePage } from '@/api/system'

defineProps({
  title: { type: String, required: true },
  /** 摘要列表 [{ id, type, typeName, title, link, time }] */
  list: { type: Array, default: () => [] }
})

const visible = ref(false)
const fullList = ref([])

const TYPE_COLORS = { approval: '#28d094', notice: '#f59a23', announcement: '#2c6ddb' }
const tagColor = (type) => TYPE_COLORS[type] || '#6b778c'
const fmtTime = (t) => (t ? String(t).replace('T', ' ').slice(0, 16) : '')

async function loadAll() {
  const data = await getNoticePage({ pageNo: 1, pageSize: 20 })
  fullList.value = data?.list || []
}
</script>

<style scoped lang="scss">
.msg {
  list-style: none;
  margin: 0;
  padding: 0;
}

.msg__row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  border-bottom: 1px solid var(--crm-border-light);

  &:last-child {
    border-bottom: none;
  }
}

.msg__tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #fff;
  line-height: 18px;
}

.msg__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--crm-text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--crm-primary);
  }
}

.msg__time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--crm-text-secondary);
}
</style>
