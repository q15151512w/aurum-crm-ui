import { ref } from 'vue'
import { getNoticeUnreadCount } from '@/api/system'

/**
 * 未读消息数：顶栏铃铛角标 + 首页消息/公告弹窗共用同一份状态，
 * 任何一处标记已读后都能立刻反映到角标上。
 *
 * 用模块级 ref 而非 Pinia —— 这块状态无需持久化、无跨路由依赖，
 * 全局唯一即可，避免为一个计数器单独开 store。
 */
const unreadCount = ref(0)

/** 从后端拉一次未读数（登录后 / 认读变化后调用） */
async function refreshUnreadCount() {
  try {
    unreadCount.value = Number(await getNoticeUnreadCount()) || 0
  } catch {
    // 拉失败不清数据，沿用旧值
  }
}

/** 本地让未读数减 n（标记单条已读后调用），不重复请求后端 */
function decrementUnread(n = 1) {
  unreadCount.value = Math.max(0, unreadCount.value - n)
}

export function useNoticeUnread() {
  return { unreadCount, refreshUnreadCount, decrementUnread }
}
