<template>
  <!--
    合同审批进度 —— 合同审核页的弹窗与合同详情页的「审批进度」Tab 共用

    为什么需要它：合同审核期间 auditStatus **一直是「审核中」**（流程是两级：
    部门主管 → 财务，只有最后一个节点通过才会变成「审核通过」）。只看状态列答不出
    「现在该谁审、下一步到谁」，用户会以为审批卡住了。

    props.contractId 变了自己重新取数（审核页弹窗每次打开的是另一行）。
  -->
  <div v-loading="loading" class="approval">
    <el-alert
      v-if="data.abnormalHint"
      class="approval__alert"
      type="warning"
      :closable="false"
      show-icon
      :title="data.abnormalHint"
    />

    <div class="approval__head">
      <el-tag :type="STATUS_TYPE[data.auditStatus] || 'info'" effect="plain">
        {{ dash(data.auditStatus) }}
      </el-tag>
      <span>{{ dash(data.flowName) }}</span>
      <span>提交人：{{ dash(data.applyUserName) }} · {{ dash(data.applyTime) }}</span>
    </div>

    <!-- 这个组件最该回答的两件事 -->
    <el-descriptions class="approval__now" :column="1" border size="small">
      <el-descriptions-item label="当前环节">
        <template v-if="data.currentNodeName">
          {{ data.currentNodeName }}
          <span v-if="pendingText" class="approval__pending">· 待 {{ pendingText }} 审批</span>
        </template>
        <span v-else>{{ dash(data.instanceStatus || data.auditStatus) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="下一步">
        <template v-if="data.nextNodeName">
          {{ data.nextNodeName }}
          <span v-if="nextText" class="approval__pending">· 预计 {{ nextText }}</span>
          <span v-else class="approval__muted">· 未解析出审批人</span>
        </template>
        <span v-else>{{ data.instanceId ? '已是最后一步' : '提交后才会确定' }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-empty v-if="!nodeList.length" :description="emptyText" :image-size="80" />

    <el-timeline v-else class="approval__timeline">
      <el-timeline-item
        v-for="node in nodeList"
        :key="node.nodeOrder"
        :type="TIMELINE_TYPE[node.progress] || 'info'"
        :hollow="node.progress === '未开始'"
      >
        <div class="approval__node">
          <span class="approval__node-name">{{ node.nodeOrder }}. {{ node.nodeName }}</span>
          <el-tag size="small" :type="TAG_TYPE[node.progress] || 'info'" effect="plain">
            {{ node.progress }}
          </el-tag>
          <span class="approval__node-type">{{ node.approveType }} · {{ node.approverType }}</span>
        </div>

        <div v-for="(task, i) in list(node.tasks)" :key="task.taskId || i" class="approval__task">
          <span class="approval__who">{{ task.approverName || ('用户' + task.approverId) }}</span>
          <el-tag size="small" :type="TASK_TAG_TYPE[task.taskStatus] || 'info'" effect="plain">
            {{ task.taskStatus }}<template v-if="task.approveResult"> · {{ task.approveResult }}</template>
          </el-tag>
          <span v-if="task.handleTime" class="approval__time">{{ task.handleTime }}</span>
          <div v-if="task.comment" class="approval__comment">意见：{{ task.comment }}</div>
        </div>

        <div v-if="list(node.pendingApproverNames).length" class="approval__task">
          <span class="approval__label">待审批人</span>
          <span>{{ list(node.pendingApproverNames).join('、') }}</span>
        </div>
        <!-- 还没到达的节点只能给「预计审批人」——措辞必须带「预计」，角色成员/组织架构会变 -->
        <div v-else-if="node.progress === '未开始'" class="approval__task">
          <span class="approval__label">预计审批人</span>
          <span v-if="list(node.predictedApproverNames).length">
            {{ list(node.predictedApproverNames).join('、') }}
          </span>
          <span v-else class="approval__muted">
            未解析出审批人（角色下无成员 / 发起人没有直属上级），走到这一步会失败
          </span>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getContractApproval } from '@/api/contract'

const props = defineProps({
  /** 合同主键（审核页传 row.contractId ?? row.id，详情页传路由参数） */
  contractId: { type: [String, Number], required: true }
})

const STATUS_TYPE = { 未提交: 'info', 审核中: 'warning', 审核通过: 'success', 审核拒绝: 'danger' }
const TAG_TYPE = { 未开始: 'info', 待审批: 'warning', 已通过: 'success', 已驳回: 'danger', 已跳过: 'info' }
const TIMELINE_TYPE = { 已通过: 'success', 待审批: 'warning', 已驳回: 'danger', 未开始: 'info', 已跳过: 'info' }
const TASK_TAG_TYPE = { 待办: 'warning', 已办: 'success', 已跳过: 'info' }

const loading = ref(false)
const data = ref({})

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)
/** 后端遵循 non_null：空字段可能整个不出现，模板里一律走这个兜底 */
const list = (v) => (Array.isArray(v) ? v : [])

const nodeList = computed(() => list(data.value.nodes))
const pendingText = computed(() => list(data.value.pendingApproverNames).join('、'))
const nextText = computed(() => list(data.value.nextApproverNames).join('、'))
const emptyText = computed(() =>
  data.value.auditStatus === '未提交' ? '尚未提交审核' : '没有可展示的审批节点'
)

async function load() {
  if (!props.contractId) return
  loading.value = true
  try {
    data.value = (await getContractApproval(props.contractId)) || {}
  } catch (e) {
    console.error('[合同审批进度] 加载失败', e)
    data.value = {}
  } finally {
    loading.value = false
  }
}

watch(() => props.contractId, load, { immediate: true })
</script>

<style scoped lang="scss">
.approval__alert {
  margin-bottom: 12px;
}

.approval__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--crm-text-secondary);
  font-size: 13px;
}

.approval__now {
  margin-bottom: 16px;
}

.approval__pending {
  color: var(--crm-warning, #e6a23c);
}

.approval__muted {
  color: var(--crm-text-secondary);
}

.approval__node {
  display: flex;
  align-items: center;
  gap: 8px;
}

.approval__node-name {
  font-weight: 600;
}

.approval__node-type,
.approval__time {
  color: var(--crm-text-secondary);
  font-size: 12px;
}

.approval__task {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 13px;
}

.approval__who {
  font-weight: 500;
}

.approval__label {
  color: var(--crm-text-secondary);
}

.approval__comment {
  flex-basis: 100%;
  color: var(--crm-text-secondary);
}
</style>
