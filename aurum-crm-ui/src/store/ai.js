import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { chatStream, deleteAiSession, getAiMessages, getAiSessions } from '@/api/ai'
import { useUserStore } from './user'

/** 工具名 → 中文标签，用于聊天里的「正在查询客户…」提示 */
export const TOOL_LABELS = {
  search_leads: '查询线索',
  get_lead_detail: '查看线索详情',
  search_customers: '查询客户',
  get_customer_detail: '查看客户详情',
  search_opportunities: '查询商机',
  search_contracts: '查询合同',
  get_dashboard_overview: '获取经营概览',
  get_sales_funnel: '获取销售漏斗'
}

/**
 * AI 小助手状态
 *
 * 用 Pinia 而不是 provide/inject 或事件总线：三个入口分别位于
 * layout（悬浮球/面板）、layout 的子组件（顶栏）、以及 dashboard 页面（快捷入口），
 * 它们唯一的公共祖先是 App，靠 props 传递要穿好几层。
 *
 * ⚠️ **会话历史的"真相来源"在服务端（Redis），不在这个 store 里。**
 * 这里的 `messages` 只是当前会话的**显示副本**：打开面板 / 切换会话时从后端拉，
 * 发送时本地追加。刷新页面后由 `open()` 重新拉取恢复 —— 而不是像以前那样直接丢光。
 * 所以不要往这里加"持久化"逻辑，那会造成两份真相。
 */
export const useAiStore = defineStore('ai', () => {
  const userStore = useUserStore()

  const visible = ref(false)
  const streaming = ref(false)
  const errorMsg = ref('')

  /** 会话列表 [{ sessionId, title, lastActive, messageCount }] */
  const sessions = ref([])
  /** 当前会话ID；null 表示「新对话」——首条消息发出后由服务端返回 */
  const currentSessionId = ref(null)
  /** 当前会话的消息（显示副本） */
  const messages = ref([])

  const loadingSessions = ref(false)
  const loadingMessages = ref(false)
  /** 历史列表是否展开 */
  const historyVisible = ref(false)

  let controller = null
  let seq = 0

  /** 有权限才显示入口与悬浮球 */
  const permitted = computed(() => userStore.hasPermission('ai:chat:use'))

  function open() {
    if (!permitted.value) return
    visible.value = true
    // 打开时同步一次：刷新过页面的话，本地是空的，要靠这里把上次的对话拉回来
    restore()
  }

  function close() {
    visible.value = false
    historyVisible.value = false
  }

  function toggle() {
    visible.value ? close() : open()
  }

  function stop() {
    controller?.abort()
    controller = null
    streaming.value = false
  }

  /** 开始新对话（不调后端：会话在首条消息发出时才真正创建） */
  function newSession() {
    currentSessionId.value = null
    messages.value = []
    errorMsg.value = ''
    historyVisible.value = false
  }

  /**
   * 恢复上次的会话。
   *
   * 只在「本地还没有当前会话」时做 —— 用户正在聊的时候切走又切回来，
   * 不该把他拉回列表里的第一条。
   */
  async function restore() {
    await loadSessions()
    if (currentSessionId.value || !sessions.value.length) return
    await selectSession(sessions.value[0].sessionId)
  }

  async function loadSessions() {
    loadingSessions.value = true
    try {
      sessions.value = (await getAiSessions()) || []
    } catch {
      // 列表拉不到不影响聊天，静默即可（错误提示由 request.js 统一处理）
    } finally {
      loadingSessions.value = false
    }
  }

  async function toggleHistory() {
    historyVisible.value = !historyVisible.value
    if (historyVisible.value) {
      await loadSessions()
    }
  }

  /** 切到某个历史会话 */
  async function selectSession(sessionId) {
    if (streaming.value) return
    currentSessionId.value = sessionId
    historyVisible.value = false
    errorMsg.value = ''
    loadingMessages.value = true
    try {
      const list = (await getAiMessages(sessionId)) || []
      messages.value = list.map((m) => ({
        id: ++seq,
        role: m.role,
        content: m.content,
        // 后端存的是工具名，这里补上中文标签，和实时对话时的观感保持一致
        tools: (m.tools || []).map((name) => ({
          name,
          label: TOOL_LABELS[name] || name,
          status: 'done'
        }))
      }))
    } catch {
      messages.value = []
    } finally {
      loadingMessages.value = false
    }
  }

  async function removeSession(sessionId) {
    try {
      await deleteAiSession(sessionId)
    } catch {
      return
    }
    if (currentSessionId.value === sessionId) {
      newSession()
    }
    await loadSessions()
  }

  async function send(text) {
    const content = (text || '').trim()
    if (!content || streaming.value) return

    errorMsg.value = ''

    messages.value.push({ id: ++seq, role: 'user', content })
    const reply = reactive({ id: ++seq, role: 'assistant', content: '', tools: [] })
    messages.value.push(reply)

    // 是不是新会话：决定了结束后要不要刷新列表（新会话得出现在列表里）
    const wasNewSession = !currentSessionId.value

    streaming.value = true
    controller = new AbortController()

    try {
      await chatStream({
        // 历史由服务端持有，这里只发会话ID + 本轮提问
        sessionId: currentSessionId.value,
        content,
        signal: controller.signal,
        onMeta: ({ sessionId }) => {
          // ⚠️ 以服务端返回的为准：首次对话它会新建一个；手里的 id 若已过期，
          //    它也会另建一个并在这里告知 —— 不采纳的话下一轮就又断成新会话了
          if (sessionId) {
            currentSessionId.value = sessionId
          }
        },
        onDelta: (t) => {
          reply.content += t
        },
        onTool: ({ name, status }) => {
          const label = TOOL_LABELS[name] || name
          const existing = reply.tools.find((t2) => t2.name === name)
          if (existing) {
            existing.status = status
          } else {
            reply.tools.push({ name, label, status })
          }
        },
        onError: ({ message }) => {
          errorMsg.value = message || '对话失败'
        }
      })
    } catch (e) {
      // 主动「停止生成」会抛 AbortError，不该当成错误提示给用户
      if (e?.name !== 'AbortError') {
        errorMsg.value = e?.message || '网络异常，请稍后重试'
      }
    } finally {
      streaming.value = false
      controller = null
      // 只在新建了会话时刷列表 —— 每轮都刷会给远程后端白加一次请求，
      // 而列表只在展开历史时才看得到，用 toggleHistory 里的那次刷新兜住时效性即可
      if (wasNewSession) {
        loadSessions()
      }
    }
  }

  return {
    visible,
    streaming,
    errorMsg,
    sessions,
    currentSessionId,
    messages,
    loadingSessions,
    loadingMessages,
    historyVisible,
    permitted,
    open,
    close,
    toggle,
    newSession,
    restore,
    toggleHistory,
    selectSession,
    removeSession,
    loadSessions,
    stop,
    send
  }
})
