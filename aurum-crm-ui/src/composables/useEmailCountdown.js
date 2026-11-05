import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { sendEmailCode } from '@/api/auth'

/**
 * 邮箱验证码倒计时
 *
 * 60 秒倒计时、邮箱格式合法才允许发、归零后重新启用。
 *
 * ## 倒计时为什么按「邮箱」共享，而不是按「入口」或全局
 *
 * 这一版是第三次调整，前两版各自错了一半，值得记下来：
 *
 * 1. **第一版：模块级一把锁（全局共享）。**
 *    理由是「不然用户切个 Tab 倒计时就归零，能无限发码」。
 *    问题：在「邮箱登录」用 A 邮箱发过码之后，去「忘记密码」填 B 邮箱，**B 也被锁着** ——
 *    而后端其实是允许的（限流是按邮箱的）。
 *
 * 2. **第二版：按入口各持一份（每个组件实例独立）。**
 *    修掉了 B 被 A 锁住的问题。代价是**同一个邮箱跨入口重发会撞后端的 1004**：
 *    在登录页给 A 发过码，切到注册页再给 A 发，后端说「发送过于频繁」，
 *    而前端的按钮上**没有任何倒计时**，用户完全不知道为什么发不出去 ——
 *    也就是「有的时候获取不到验证码」。
 *
 * 3. **本版：按邮箱（归一化后）共享倒计时。**
 *    「不同邮箱互不影响」和「同一邮箱不会撞 1004」两个性质**同时成立** ——
 *    因为后端 `auth:email:limit:{email}` 本来就是**按邮箱**限流的，
 *    前端按同一个维度记，才和后端口径一致。
 *
 * ⚠️ 所以：**别改回「按入口各持一份」，也别退化成全局一把锁。**
 *    判断口径的唯一依据是后端 —— 它按什么维度限流，前端就按什么维度记。
 *
 * ⚠️ 另外用 sessionStorage 兜了一层：后端那把锁在 Redis 里、刷新页面不会消失，
 *    前端只在内存里记的话，一刷新按钮又可点，点了照样撞 1004。
 *    （这层是可选的降级：隐私模式下 sessionStorage 不可用时忽略异常，只是失去
 *      「刷新后仍显示倒计时」，不影响发码本身。）
 */

const COUNTDOWN_SECONDS = 60

/** sessionStorage 的 key —— 存 { email: 截止时间戳 } */
const STORAGE_KEY = 'aurum:email-code-deadlines'

/** 邮箱（归一化）→ 倒计时截止时间戳（ms）。模块级：三个入口共享同一份 */
const deadlineByEmail = new Map()

/** 每秒自增，用来驱动「剩余秒数」重算（模板里读到它才会跟着刷新） */
const tick = ref(0)
let timer = null

/** 邮箱归一化：与后端 `EmailCodeServiceImpl#normalize` 保持一致（trim + 小写） */
const emailKey = (email) => String(email || '').trim().toLowerCase()

function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const now = Date.now()
    for (const [key, deadline] of Object.entries(JSON.parse(raw))) {
      if (typeof deadline === 'number' && deadline > now) deadlineByEmail.set(key, deadline)
    }
  } catch {
    // 隐私模式 / 存储被禁用：忽略即可，只是失去「刷新后仍显示倒计时」
  }
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(deadlineByEmail)))
  } catch {
    // 同上
  }
}

loadFromStorage()

/**
 * 每秒重算一次，并在**没有任何倒计时**时自己把定时器收掉。
 *
 * ⚠️ 定时器是模块级的、被所有实例共享 —— 不要在这里做「每个实例一个 setInterval」，
 *    那会随入口数量线性增长，而且没人负责清理（历史上就漏清理过）。
 */
function ensureTimer() {
  if (timer) return
  timer = setInterval(() => {
    tick.value += 1
    const now = Date.now()
    for (const [key, deadline] of deadlineByEmail) {
      if (deadline <= now) deadlineByEmail.delete(key)
    }
    if (deadlineByEmail.size === 0) {
      clearInterval(timer)
      timer = null
      persist()
    }
  }, 1000)
}

/**
 * 该邮箱还剩几秒才能重发（0 = 现在就能发）。
 *
 * 读一次 `tick` 就建立了响应式依赖，所以**在模板里调用它会每秒刷新**。
 */
export function remainingSeconds(email) {
  // eslint-disable-next-line no-unused-expressions -- 这一行的目的是建立依赖，不是取值
  tick.value
  const deadline = deadlineByEmail.get(emailKey(email))
  if (!deadline) return 0
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}

/**
 * 邮箱格式校验。
 *
 * ⚠️ 刻意用**宽松**规则（有 @、两边非空、域名里有点），而不是 RFC 5322 的完整正则：
 * 邮箱的真实规则复杂到没有实用价值的正则能覆盖，写严了只会误杀合法邮箱
 * （比如 `a+b@x.co` 这种带加号、或者新顶级域名）。
 * 真正的可用性只有「信能不能寄到」能证明，所以前端只挡明显不对的输入，
 * 后端用 `@Email` 再做一道，最终以「是否收到信」为准。
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

export function useEmailCountdown() {
  /** 本实例是否有请求在飞（防连点）。⚠️ 这个是**按实例**的，不是按邮箱的 */
  const sending = ref(false)

  /**
   * 按钮是否可点。
   *
   * ⚠️ 这里**只**判断「倒计时中 / 请求中」两件事，**不**判断邮箱是否合法 ——
   *    这是刻意的：把邮箱不合法也塞进来的话，按钮会变成一个**完全没有反馈的死按钮**
   *    （用户填了 `abc@qq` 这种少个点的邮箱，按钮就是灰的，点了没反应、也没有任何提示），
   *    症状正好也是「获取不到验证码」。现在改成允许点击，点了由 send() 明确告诉他哪里不对。
   */
  const canSend = (email) => remainingSeconds(email) === 0 && !sending.value

  /**
   * 按钮文案。传当前输入的邮箱，倒计时按**该邮箱**算。
   *
   * ⚠️ 是函数而不是 computed —— 因为要按邮箱取值。调用方在模板里写
   *    `{{ buttonText(form.email) }}`；函数内读了 `tick`，所以每秒会刷新。
   */
  const buttonText = (email) => {
    const seconds = remainingSeconds(email)
    return seconds > 0 ? `${seconds} 秒后重发` : '获取验证码'
  }

  /**
   * 发送验证码
   *
   * 不区分场景（登录/注册/找回密码共用一套验证码），所以只需要邮箱。
   *
   * @param {string} email
   */
  async function send(email) {
    // 倒计时中 / 请求中：真的不该发，静默返回（按钮此时本就是禁用的）
    if (remainingSeconds(email) > 0 || sending.value) return

    // 邮箱不合法：给出**明确提示**，而不是让按钮默默点不动
    const to = String(email || '').trim()
    if (!isValidEmail(to)) {
      ElMessage.warning('请输入正确的邮箱地址')
      return
    }

    sending.value = true
    try {
      await sendEmailCode(to)
      ElMessage.success('验证码已发送，请查收邮件（含垃圾箱）')
      deadlineByEmail.set(emailKey(to), Date.now() + COUNTDOWN_SECONDS * 1000)
      persist()
      ensureTimer()
    } catch (e) {
      // 失败提示已由 request.js 统一处理，这里不再弹。
      //
      // ⚠️ 只有 1004（发送过于频繁）才补上倒计时，**其它失败一律允许立刻重试**：
      //    后端在「邮件发送失败」（1009）时会把限流一并退还，此时锁用户 60 秒
      //    纯属帮倒忙 —— 他既没收到信、又被拦住不能重发。
      //    （这条区分依赖 request.js 挂在 error 上的 `bizCode`。）
      if (e?.bizCode === 1004) {
        deadlineByEmail.set(emailKey(to), Date.now() + COUNTDOWN_SECONDS * 1000)
        persist()
        ensureTimer()
      }
    } finally {
      sending.value = false
    }
  }

  return { sending, canSend, buttonText, send }
}
