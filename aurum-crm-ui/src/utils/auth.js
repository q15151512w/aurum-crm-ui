/**
 * 登录凭证存取
 *
 * 用 localStorage 而不是 sessionStorage：关闭标签页后仍保持登录。
 * 用 cookie：需要处理 CSRF，且前后端分离下跨域配置麻烦。
 */

const TOKEN_KEY = 'AurumCRM-Token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  return localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  return localStorage.removeItem(TOKEN_KEY)
}
