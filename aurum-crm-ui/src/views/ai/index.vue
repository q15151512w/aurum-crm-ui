<template>
  <!--
    AI 小助手（整页版）

    与右下角那个紧凑浮层（components/AiChatPanel.vue）**共用同一个 store**，
    所以两边看到的是同一场对话 —— 在此页聊到一半收起、点悬浮球还能接着聊。

    三个入口的分工：
      · 顶栏「AI小助手」/ 首页快捷入口 → 跳到这里（整页，适合长对话）
      · 右下角悬浮球                → 弹出紧凑浮层（不打断当前页面）
  -->
  <div class="ai-page">
    <aside class="ai-page__side">
      <el-button class="ai-page__new" type="primary" plain @click="aiStore.newSession()">
        <el-icon><Plus /></el-icon>
        新对话
      </el-button>

      <div class="ai-page__list">
        <div v-if="aiStore.loadingSessions" class="ai-page__tip">加载中…</div>
        <div v-else-if="!aiStore.sessions.length" class="ai-page__tip">
          还没有历史对话。发送第一条消息后会自动出现在这里。
        </div>
        <div
          v-for="s in aiStore.sessions"
          v-else
          :key="s.sessionId"
          class="ai-page__item"
          :class="{ 'is-active': s.sessionId === aiStore.currentSessionId }"
          @click="aiStore.selectSession(s.sessionId)"
        >
          <div class="ai-page__item-main">
            <div class="ai-page__item-title">{{ s.title || '新会话' }}</div>
            <div class="ai-page__item-meta">
              {{ s.messageCount || 0 }} 条 · {{ formatTime(s.lastActive) }}
            </div>
          </div>
          <el-icon
            class="ai-page__del"
            title="删除该对话"
            @click.stop="aiStore.removeSession(s.sessionId)"
          >
            <Delete />
          </el-icon>
        </div>
      </div>
    </aside>

    <section class="ai-page__main">
      <div ref="bodyRef" class="ai-page__body">
        <div v-if="aiStore.loadingMessages" class="ai-page__tip">正在加载历史…</div>

        <div v-else-if="!aiStore.messages.length" class="ai-empty">
          <p class="ai-empty__tip">可以直接问我 CRM 里的数据，例如：</p>
          <div v-for="s in SUGGESTIONS" :key="s" class="ai-empty__item" @click="submit(s)">
            {{ s }}
          </div>
        </div>

        <div v-for="m in aiStore.messages" :key="m.id" class="ai-msg" :class="'ai-msg--' + m.role">
          <!--
            ⚠️ 纯文本渲染，不用 v-html：模型输出是不可信内容，
            直接当 HTML 插入等于把一个 XSS 入口开在聊天框里。
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

        <div v-if="showThinking" class="ai-msg ai-msg--assistant">
          <div class="ai-msg__text ai-msg__text--muted">正在思考…</div>
        </div>

        <div v-if="aiStore.errorMsg" class="ai-error">{{ aiStore.errorMsg }}</div>
      </div>

      <div class="ai-page__foot">
        <el-input
          v-model="draft"
          type="textarea"
          :rows="3"
          resize="none"
          :disabled="aiStore.streaming"
          placeholder="问点什么…（Enter 发送，Shift + Enter 换行）"
          @keydown.enter.exact.prevent="submit(draft)"
        />
        <el-button v-if="aiStore.streaming" class="ai-page__send" @click="aiStore.stop()">
          停止
        </el-button>
        <el-button
          v-else
          class="ai-page__send"
          type="primary"
          :disabled="!draft.trim()"
          @click="submit(draft)"
        >
          发送
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { useAiStore } from '@/store/ai'

const aiStore = useAiStore()

const draft = ref('')
const bodyRef = ref(null)

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
 * 会话列表里的时间：只给「多久以前」。
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

onMounted(() => {
  // 进整页就把右下角浮层收起来：用户是从浮层点顶栏/MENU 过来的话，
  // 留着它只会挡住刚打开的页面内容
  aiStore.close()
  // 把会话拉回来（刷新后也能恢复上次的对话）
  aiStore.restore()
})

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
.ai-page {
  display: flex;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

// —— 左侧会话列表 ——
.ai-page__side {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
}

.ai-page__new {
  width: 100%;
  margin-bottom: 12px;
}

.ai-page__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.ai-page__tip {
  padding: 12px 6px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--crm-text-secondary, #909399);
}

.ai-page__item {
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

.ai-page__item-main {
  flex: 1;
  min-width: 0;
}

.ai-page__item-title {
  font-size: 13px;
  color: var(--crm-text-primary, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-page__item-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--crm-text-secondary, #909399);
}

.ai-page__del {
  flex-shrink: 0;
  color: #c0c4cc;

  &:hover {
    color: #f56c6c;
  }
}

// —— 右侧对话区 ——
.ai-page__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border-radius: 10px;
}

.ai-page__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
}

.ai-empty__tip {
  margin: 4px 0 10px;
  font-size: 13px;
  color: var(--crm-text-secondary, #909399);
}

.ai-empty__item {
  display: inline-block;
  padding: 8px 12px;
  margin: 0 8px 8px 0;
  font-size: 13px;
  color: var(--crm-primary, #2c6ddb);
  background: #fafbff;
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
  margin-bottom: 14px;
}

.ai-msg--user {
  align-items: flex-end;
}

.ai-msg--assistant {
  align-items: flex-start;
}

.ai-msg__text {
  max-width: 76%;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-msg--user .ai-msg__text {
  background: var(--crm-primary, #2c6ddb);
  color: #fff;
  border-top-right-radius: 2px;
}

.ai-msg--assistant .ai-msg__text {
  background: #f5f7fa;
  color: var(--crm-text-primary, #303133);
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

.ai-page__foot {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--crm-border-color, #ebeef5);
}

.ai-page__send {
  flex-shrink: 0;
}
</style>
