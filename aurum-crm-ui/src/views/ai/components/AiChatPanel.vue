<template>
  <div v-show="aiStore.visible" class="ai-panel" :style="panelStyle">
    <div
      class="ai-panel__head"
      :class="{ 'is-dragging': dragging }"
      @pointerdown="onDragStart"
    >
      <span class="ai-panel__title">
        <el-icon><MagicStick /></el-icon>
        AI 小助手
      </span>
      <span class="ai-panel__drag-hint">拖拽移动</span>
      <div class="ai-panel__acts">
        <el-button link size="small" :disabled="aiStore.streaming" @click="aiStore.newSession()">
          新对话
        </el-button>
        <el-button link size="small" class="ai-panel__history-btn" @click="aiStore.toggleHistory()">
          <el-icon><Clock /></el-icon>
        </el-button>
        <el-button link size="small" title="收起" @click="aiStore.close()">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 历史会话列表：展开时占满内容区 -->
    <div v-if="aiStore.historyVisible" class="ai-history">
      <div v-if="aiStore.loadingSessions" class="ai-history__tip">加载中…</div>
      <div v-else-if="!aiStore.sessions.length" class="ai-history__tip">
        还没有历史对话。发送第一条消息后会自动出现在这里。
      </div>
      <template v-else>
        <div
          v-for="s in aiStore.sessions"
          :key="s.sessionId"
          class="ai-history__item"
          :class="{ 'is-active': s.sessionId === aiStore.currentSessionId }"
        >
          <!-- 点标题区切换；删除单独一个图标，@click.stop 免得误删 -->
          <div class="ai-history__main" @click="aiStore.selectSession(s.sessionId)">
            <div class="ai-history__title">{{ s.title || '新会话' }}</div>
            <div class="ai-history__meta">
              {{ s.messageCount || 0 }} 条 · {{ formatTime(s.lastActive) }}
            </div>
          </div>
          <el-icon class="ai-history__del" title="删除该对话" @click.stop="aiStore.removeSession(s.sessionId)">
            <Delete />
          </el-icon>
        </div>
      </template>
    </div>

    <!-- 对话区 -->
    <template v-else>
      <div ref="bodyRef" class="ai-panel__body">
        <div v-if="aiStore.loadingMessages" class="ai-empty__tip">正在加载历史…</div>

        <!-- 空态：给几个能直接点的示例问题，比一句「请输入」有用得多 -->
        <div v-else-if="!aiStore.messages.length" class="ai-empty">
          <p class="ai-empty__tip">可以直接问我 CRM 里的数据，例如：</p>
          <div v-for="s in SUGGESTIONS" :key="s" class="ai-empty__item" @click="submit(s)">
            {{ s }}
          </div>
        </div>

        <div v-for="m in aiStore.messages" :key="m.id" class="ai-msg" :class="'ai-msg--' + m.role">
          <!--
            ⚠️ 用纯文本渲染，不用 v-html：模型输出是不可信内容，
            直接当 HTML 插入等于把一个 XSS 入口开在聊天框里。
            pre-wrap 保留换行，可读性够用。
          -->
          <div class="ai-msg__text">{{ m.content }}</div>
          <div v-if="m.tools && m.tools.length" class="ai-msg__tools">
            <span
              v-for="t in m.tools"
              :key="t.name"
              class="ai-tool"
              :class="{ 'is-done': t.status === 'done' }"
            >
              {{ t.label }}{{ t.status === 'running' ? '…' : '' }}
            </span>
          </div>
        </div>

        <!-- 生成中但还没有任何字符：给个「思考中」的占位，避免看起来像卡住了 -->
        <div v-if="showThinking" class="ai-msg ai-msg--assistant">
          <div class="ai-msg__text ai-msg__text--muted">正在思考…</div>
        </div>

        <div v-if="aiStore.errorMsg" class="ai-error">{{ aiStore.errorMsg }}</div>
      </div>

      <div class="ai-panel__foot">
        <el-input
          v-model="draft"
          type="textarea"
          :rows="2"
          resize="none"
          :disabled="aiStore.streaming"
          placeholder="问点什么…（Enter 发送，Shift + Enter 换行）"
          @keydown.enter.exact.prevent="submit(draft)"
        />
        <el-button v-if="aiStore.streaming" class="ai-panel__send" @click="aiStore.stop()">停止</el-button>
        <el-button
          v-else
          class="ai-panel__send"
          type="primary"
          :disabled="!draft.trim()"
          @click="submit(draft)"
        >
          发送
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Clock, Close, Delete, MagicStick } from '@element-plus/icons-vue'
import { useAiStore } from '@/store/ai'

const aiStore = useAiStore()

const draft = ref('')
const bodyRef = ref(null)

// ---------- 面板全局拖拽 ----------
// 面板默认定位在右下角（right/bottom 固定）；一旦用户拖过，
// 就切换到 left/top 定位，由拖拽动态计算，并限制在视口内。
const PANEL_WIDTH = 380
const PANEL_HEIGHT = 520
const EDGE_GAP = 12

const pos = ref(null) // { left, top }，null = 用默认右下角定位
const dragging = ref(false)

const panelStyle = computed(() => {
  if (!pos.value) return {}
  return { left: `${pos.value.left}px`, top: `${pos.value.top}px` }
})

function onDragStart(e) {
  // 只认主键；落在按钮/图标上不触发拖拽，否则会误吞「新对话/收起」等点击
  if (e.button !== 0) return
  const target = e.target
  if (target.closest('button') || target.closest('.el-icon')) return

  const panel = e.currentTarget.closest('.ai-panel')
  if (!panel) return

  const rect = panel.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  const startLeft = rect.left
  const startTop = rect.top

  dragging.value = true

  const onMove = (ev) => {
    const left = clamp(startLeft + (ev.clientX - startX), EDGE_GAP, window.innerWidth - rect.width - EDGE_GAP)
    const top = clamp(startTop + (ev.clientY - startY), EDGE_GAP, window.innerHeight - rect.height - EDGE_GAP)
    pos.value = { left, top }
  }

  const onUp = () => {
    dragging.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), Math.max(min, max))
}

/** 示例问题：覆盖各工具，让用户一眼知道能问什么 */
const SUGGESTIONS = [
  '我现在有多少待处理的线索？',
  '本月新增了多少客户？',
  '看一下销售漏斗各阶段的情况',
  '我关注的客户有哪些？'
]

/** 已经开始生成、但还没吐出任何正文，也没有工具在跑 */
const showThinking = computed(() => {
  if (!aiStore.streaming) return false
  const last = aiStore.messages[aiStore.messages.length - 1]
  return !!last && last.role === 'assistant' && !last.content && !(last.tools || []).length
})

function submit(text) {
  const value = (text || '').trim()
  if (!value) return
  aiStore.send(value)
  draft.value = ''
}

/**
 * 会话列表里的时间：只给「多久以前」，不显示完整时间戳。
 *
 * 列表里要的是「认出是哪次对话」，精确到秒没有意义；
 * 而"3 小时前"这种相对时间一眼就能对上刚才/昨天/上周。
 */
function formatTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

// 有新内容就滚到底部。监听「总长度」而不是 messages 引用 ——
// 流式追加时 messages 引用不变，只 watch 引用不会触发。
watch(
  () => aiStore.messages.reduce((n, m) => n + (m.content || '').length, 0),
  async () => {
    await nextTick()
    if (bodyRef.value) {
      bodyRef.value.scrollTop = bodyRef.value.scrollHeight
    }
  }
)
</script>

<style scoped lang="scss">
.ai-panel {
  position: fixed;
  right: 32px;
  bottom: 96px;
  z-index: 1991;
  width: 380px;
  height: 520px;
  max-height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.ai-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--crm-border-color, #ebeef5);
  background: #fafbff;
  cursor: grab;
  user-select: none;
  touch-action: none;

  &.is-dragging {
    cursor: grabbing;
  }
}

.ai-panel__drag-hint {
  flex: 1;
  margin-left: 8px;
  font-size: 11px;
  color: var(--crm-text-secondary, #909399);
}

.ai-panel__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--crm-text-primary, #303133);
}

.ai-panel__acts {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ai-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  background: var(--crm-bg-page, #f5f7fa);
}

// —— 历史会话列表 ——
.ai-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  background: #fff;
}

.ai-history__tip {
  padding: 16px 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--crm-text-secondary, #909399);
}

.ai-history__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #f5f7fa;
  }

  &.is-active {
    background: #f2f7ff;
  }
}

.ai-history__main {
  flex: 1;
  min-width: 0;
}

.ai-history__title {
  font-size: 13px;
  color: var(--crm-text-primary, #303133);
  // 标题可能很长，一行截断
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-history__meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--crm-text-secondary, #909399);
}

.ai-history__del {
  flex-shrink: 0;
  color: #c0c4cc;

  &:hover {
    color: #f56c6c;
  }
}

// —— 消息区 ——
.ai-empty__tip {
  margin: 4px 0 10px;
  font-size: 13px;
  color: var(--crm-text-secondary, #909399);
}

.ai-empty__item {
  padding: 8px 10px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--crm-primary, #2c6ddb);
  background: #fff;
  border: 1px solid var(--crm-border-color, #ebeef5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--crm-primary, #2c6ddb);
    background: #f2f7ff;
  }
}

.ai-msg {
  display: flex;
  flex-direction: column;
  margin-bottom: 10px;
}

.ai-msg--user {
  align-items: flex-end;
}

.ai-msg--assistant {
  align-items: flex-start;
}

.ai-msg__text {
  max-width: 84%;
  padding: 8px 11px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  // 保留模型输出里的换行；文字本身当纯文本处理（见模板里的说明）
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-msg--user .ai-msg__text {
  background: var(--crm-primary, #2c6ddb);
  color: #fff;
  border-top-right-radius: 2px;
}

.ai-msg--assistant .ai-msg__text {
  background: #fff;
  color: var(--crm-text-primary, #303133);
  border: 1px solid var(--crm-border-color, #ebeef5);
  border-top-left-radius: 2px;
}

.ai-msg__text--muted {
  color: var(--crm-text-secondary, #909399);
}

.ai-msg__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.ai-tool {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  color: #b26a00;
  background: #fff7e6;
  border: 1px solid #ffe0a3;

  &.is-done {
    color: #529b2e;
    background: #f0f9eb;
    border-color: #d1edc4;
  }
}

.ai-error {
  margin-top: 4px;
  padding: 8px 10px;
  font-size: 12px;
  color: #c45656;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 6px;
}

.ai-panel__foot {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--crm-border-color, #ebeef5);
  background: #fff;
}

.ai-panel__send {
  flex-shrink: 0;
}
</style>
