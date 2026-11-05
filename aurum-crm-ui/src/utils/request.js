import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getToken, removeToken } from '@/utils/auth'
import settings from '@/settings'

/**
 * axios 封装
 *
 * ⚠️ 本文件严格实现后端约定的响应格式，改动前请先看
 *    《技术栈说明.md》3.5 节 与 后端 README 的「HTTP 状态码约定」。
 *
 * 后端约定（两条路径，都要处理）：
 *   1. HTTP 200 + body.code
 *        code === 0    成功
 *        code === 401  未登录 / token 失效
 *        code === 403  权限不足
 *        code === 400  参数校验失败
 *        其他非 0       业务规则拒绝
 *   2. HTTP 500        未预期的服务端异常（唯一不走 body.code 的情况）
 */

/** 防止 token 失效时并发请求弹出多个「重新登录」弹窗 */
let isRelogining = false

/**
 * 弹错误提示 —— 但调用方传了 `silent: true` 时不弹。
 *
 * 用于**后台预取 / 探测类**请求：那些请求不是用户主动发起的操作，
 * 失败了调用方自己会兜底（走缓存或默认值），再弹一条「服务器繁忙」
 * 只会让人以为页面坏了，而且每次进页面都弹一次。
 *
 * 与 `silent401` 的区别：`silent401` 只管「401 时不要弹重新登录框」，
 * 本开关管「任何错误都别弹」。两者可以同时用。
 */
const toast = (config, message) => {
  if (config?.silent) return
  ElMessage.error(message)
}

const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json;charset=utf-8' }
})

// ============================================================================
//  请求拦截器
// ============================================================================
service.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      // 与后端 sa-token.token-name=Authorization、token-prefix=Bearer 对应
      config.headers['Authorization'] = 'Bearer ' + token
    }

    // GET 请求加时间戳，绕过浏览器缓存（IE 时代的习惯，现代浏览器也仍有边角情况）
    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() }
    }

    return config
  },
  (error) => {
    console.error('[请求发送失败]', error)
    return Promise.reject(error)
  }
)

// ============================================================================
//  响应拦截器
// ============================================================================
service.interceptors.response.use(
  // ---------- HTTP 状态码 2xx ----------
  (response) => {
    const res = response.data

    // 后端约定：文件下载等场景可能是 Blob，直接返回
    if (response.request.responseType === 'blob' ||
        response.request.responseType === 'arraybuffer') {
      return response.data
    }

    // 成功
    if (res.code === 0) {
      return res.data
    }

    // 未登录 / token 失效
    if (res.code === 401) {
      // 静默模式：这是「登录态探测」请求（/auth/me）失败，不是用户主动发起的操作。
      // 不弹「重新登录」对话框 —— 调用方（路由守卫）会自己清状态并跳登录页，
      // 用户看到的应该是一个干净的登录页，而不是一个写着后端文案的警告框。
      // 详见 api/auth.js 的 getInfo。
      if (response.config.silent401) {
        return Promise.reject(withBizCode(new Error(res.message || '未登录'), res.code))
      }
      handleUnauthorized(res.message)
      return Promise.reject(withBizCode(new Error(res.message || '未登录'), res.code))
    }

    // 权限不足
    if (res.code === 403) {
      toast(response.config, res.message || '没有该操作权限')
      return Promise.reject(withBizCode(new Error(res.message || '权限不足'), res.code))
    }

    // 其他业务错误（含 400 参数校验失败）
    toast(response.config, res.message || '操作失败')
    // ⚠️ 把业务码一并挂到 error 上再抛出去。
    //    只带 message 的话，调用方拿不到码，只能靠**匹配中文文案**去判断是哪种失败 ——
    //    文案一改（或做多语言）判断就静默失效。
    //    现在调用方可以写 `if (e?.bizCode === 1004)`，见 composables/useEmailCountdown.js。
    //
    //    ⚠️ 字段名用 `bizCode` 而不是 `code`：axios 自己的 error 上 `code` 是
    //    `'ECONNABORTED'` / `'ERR_NETWORK'` 这类**字符串**，同名会混淆两种来源。
    return Promise.reject(withBizCode(new Error(res.message || '操作失败'), res.code))
  },

  // ---------- HTTP 状态码非 2xx ----------
  (error) => {
    // 服务端未返回响应（网络断了 / 后端没启动 / 跨域被拦）
    if (!error.response) {
      const msg = error.code === 'ECONNABORTED'
        ? '请求超时，请稍后重试'
        : '网络异常，请检查后端服务是否已启动'
      toast(error.config, msg)
      return Promise.reject(error)
    }

    const { status, data } = error.response

    // ⚠️ 唯一不走 body.code 的分支：未预期的服务端异常
    if (status === 500) {
      // 后端已把堆栈打进日志，这里只给用户友好提示
      toast(error.config, '服务器繁忙，请稍后重试')
      return Promise.reject(error)
    }

    if (status === 401) {
      // 同「res.code === 401」：探测类请求静默失败（后端目前返回的是 200 + code:401，
      // 这个分支是防御 —— 将来若改成真正的 HTTP 401，行为保持一致）
      if (error.config?.silent401) {
        return Promise.reject(error)
      }
      handleUnauthorized()
      return Promise.reject(error)
    }

    if (status === 403) {
      toast(error.config, '没有该操作权限')
      return Promise.reject(error)
    }

    if (status === 404) {
      toast(error.config, '请求的接口不存在')
      return Promise.reject(error)
    }

    toast(error.config, data?.message || `请求失败（${status}）`)
    return Promise.reject(error)
  }
)

// ============================================================================
//  辅助
// ============================================================================

/**
 * 把后端的业务码挂到 error 上。
 *
 * 只带 message 的话，调用方无法可靠地区分「哪种业务失败」——
 * 只能去匹配中文文案，文案一改就静默失效。
 *
 * ⚠️ 字段名是 `bizCode` 而不是 `code`：axios 自己的 error 上 `code` 是
 * `'ECONNABORTED'` / `'ERR_NETWORK'` 这类**字符串**，同名会让两种来源混淆。
 *
 * @param {Error} error
 * @param {number} bizCode 后端 CommonResult.code
 */
function withBizCode(error, bizCode) {
  error.bizCode = bizCode
  return error
}

/**
 * 统一处理「登录态失效」
 *
 * 并发请求同时返回 401 时，只弹一次弹窗、只跳一次登录页。
 */
function handleUnauthorized(message) {

  if (isRelogining) return
  isRelogining = true

  ElMessageBox.confirm(
    message || '登录状态已过期，请重新登录',
    '提示',
    { confirmButtonText: '重新登录', cancelButtonText: '取消', type: 'warning' }
  )
    .then(() => {
      redirectToLogin()
    })
    .catch(() => {
      // 用户点了取消，也清掉 token，避免继续发无效请求
      removeToken()
    })
    .finally(() => {
      isRelogining = false
    })
}

function redirectToLogin() {
  removeToken()
  const redirect = encodeURIComponent(window.location.hash.replace(/^#/, '') || '/')
  window.location.href = `/#${settings.loginPath}?redirect=${redirect}`
  window.location.reload()
}

export default service
