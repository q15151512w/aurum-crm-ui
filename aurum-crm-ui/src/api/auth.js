import request from '@/utils/request'
import { mockUserInfo } from '@/mock/menu'
import { user, insertRow } from '@/mock/db'
// 开关与延迟统一从 _mock 引 —— 早先这个文件自己又声明了一份 USE_MOCK，
// 于是「一个项目里有两个开关」，且 `import.meta.env` 让这个文件没法脱离 vite 单测
import { USE_MOCK, delay } from './_mock'

/**
 * 认证相关接口
 *
 * ⚠️ 当前后端 /auth/* 尚未实现，通过 VITE_APP_USE_MOCK 开关走本地 mock，
 *    以便前端的动态菜单、路由守卫可以端到端跑通。
 *
 * 后端就绪后：
 *   1. 把 .env.development 的 VITE_APP_USE_MOCK 改为 false
 *   2. 本文件里的 mock 分支可整段删除
 */

/**
 * 密码登录
 * @param {{ username: string, password: string }} data
 * @returns {Promise<{ token: string }>}
 */
export async function login(data) {
  if (USE_MOCK) {
    await delay(500)
    console.info('[MOCK] 登录成功，账号：', data.username)
    return { token: 'mock-token-' + Date.now(), expiresIn: 86400 }
  }
  return request({ url: '/auth/login', method: 'post', data })
}

/** 退出登录 */
export async function logout() {
  if (USE_MOCK) {
    await delay(200)
    return null
  }
  return request({ url: '/auth/logout', method: 'post' })
}

/**
 * 获取当前登录用户信息（含菜单树、权限标识）
 *
 * 这是【动态菜单的数据源】：userStore.fetchUserInfo() 会读这里的 menus。
 *
 * @returns {Promise<{ userId, username, realName, deptId, roles, permissions, menus }>}
 */
export async function getInfo() {
  if (USE_MOCK) {
    await delay(300)
    console.info('[MOCK] 返回用户信息与菜单树，菜单节点数：', countNodes(mockUserInfo.menus))
    return mockUserInfo
  }
  // ⚠️ silent401：这是「登录态探测」，不是用户发起的操作。
  //
  //    localStorage 里留着一个已失效的 token（会话过期 / 后端重启 / Redis 被清）时，
  //    路由守卫会因为「看到 token 就认为已登录」而调到这里 → 后端回 401
  //    「未提供登录凭证，请先登录」→ 默认会弹出那个写着后端文案的「重新登录」警告框。
  //    用户的实际感受是：「我只是想注册/登录，怎么冒出个登录权限错误？」
  //
  //    带上 silent401 后，这里静默失败，由路由守卫的 catch 清掉 token 并跳到登录页 ——
  //    用户看到的是一个干净的登录页，这才是对的。
  return request({ url: '/auth/me', method: 'get', silent401: true })
}

/**
 * 邮箱验证码登录
 * @param {{ email: string, emailCode: string }} data
 */
export async function loginByEmail(data) {
  if (USE_MOCK) {
    await delay(500)
    console.info('[MOCK] 邮箱验证码登录：', data.email)
    return { token: 'mock-token-' + Date.now(), expiresIn: 86400 }
  }
  return request({ url: '/auth/login/email', method: 'post', data })
}

/**
 * 注册账号
 *
 * ⚠️ 注册 = 投递申请，**不是开通账号**（见《05-接口文档》2.4）：
 *    落地时 status = 2（禁用）、不写 sys_user_role。
 *    管理员在「人员管理」里筛「已禁用」找到它 → 分配角色 → 激活，才能登录。
 *
 * mock 下要把这条记录真的写进 user 表 —— 否则注册完在「人员管理」里什么都看不到，
 * 「注册 → 分配角色 → 激活」这条链路没法演示。
 *
 * @param {{ username, email, emailCode, password }} data
 */
export async function register(data) {
  if (USE_MOCK) {
    await delay(500)
    // 注意：不落 password（mock 的 user 行里没有这个字段），也不给角色
    insertRow(user, {
      // 注册时拿不到真实姓名，先用账号占位，管理员分配角色时一并补上
      name: data.username,
      username: data.username,
      // 邮箱是注册时的身份凭证，同时也是之后登录/找回密码的凭据，必须落库。
      // 手机号不再参与注册（原先是必填），由管理员在「人员管理」里补。
      email: data.email,
      phone: '',
      deptId: null,
      deptName: '',
      superiorName: '',
      roleName: '',
      workStatus: '在职',
      // 关键：禁用。登录接口会按 status 挡下，见 05 文档 2.1
      accountStatus: '已禁用'
    })
    console.info('[MOCK] 注册成功（账号已禁用，需管理员分配角色后激活）：', data.username)
    return null
  }
  return request({ url: '/auth/register', method: 'post', data })
}

/**
 * 忘记密码（用邮箱验证码重置）
 * @param {{ email, emailCode, newPassword }} data
 */
export async function forgotPassword(data) {
  if (USE_MOCK) {
    await delay(500)
    console.info('[MOCK] 密码已重置：', data.email)
    return null
  }
  return request({ url: '/auth/password/forgot', method: 'post', data })
}

/**
 * 修改密码（顶栏「修改密码」）
 *
 * ⚠️ 《05-接口文档》2.1 只给了登录的请求体，`PUT /auth/password` 只写了路径，
 *    没给字段。这里按通行做法取 { oldPassword, newPassword }，**接后端时要核对**。
 *
 * @param {{ oldPassword: string, newPassword: string }} data
 */
export async function changePassword(data) {
  if (USE_MOCK) {
    await delay(500)
    console.info('[MOCK] 密码已修改')
    return null
  }
  return request({ url: '/auth/password', method: 'put', data })
}

/**
 * 修改个人资料（顶栏「个人信息」）
 *
 * 对应《05-接口文档》2.8 的 `PUT /auth/profile`。
 *
 * ⚠️ **只能改自己**：用户 ID 取自登录态，请求体里没有、也不该有 userId。
 *    能改的字段就下面五个 —— `username / deptId / 角色 / 状态` 都不在后端的
 *    `ProfileUpdateReqVO` 里，传了也不会生效（那些属于人员管理，要另外的权限）。
 *
 * ⚠️ 后端是「**不传 = 不改**」的语义（`update-strategy: not_null`）。
 *    所以传 `phone: ''` 是「把手机号改成空串」，而**不是**「手机号不变」——
 *    要清空就传空串，不想动这个字段就别带这个 key。
 *
 * 回显值来自 `GET /auth/me`（`UserInfoRespVO` 里的 nickname/phone/email/avatar），
 * 前端已存在 `userStore.userInfo` 里，弹窗打开时不用再请求。
 *
 * @param {{ realName?: string, nickname?: string, phone?: string, email?: string, avatar?: string }} data
 */
export async function updateProfile(data) {
  if (USE_MOCK) {
    await delay(400)
    // mock 的「当前登录人」就是 mockUserInfo 本身（/auth/me 的返回值）。
    // 必须逐字段写回 —— 否则保存后再打开弹窗又变回原值，那是「假成功」，
    // 正是 scripts/check-static.mjs 第 11 条要抓的东西。
    Object.keys(data).forEach((k) => {
      if (data[k] !== undefined) mockUserInfo[k] = data[k]
    })
    console.info('[MOCK] 个人资料已保存：', data)
    return null
  }
  return request({ url: '/auth/profile', method: 'put', data })
}

/**
 * 发送邮箱验证码（后端 60 秒限流）
 *
 * mock 下固定用 123456 并打到控制台 —— 否则本地跑的时候用户根本不知道
 * 该填什么，只能瞎猜（mock 模式下并没有真的发信）。
 *
 * ⚠️ **不区分场景**：登录 / 注册 / 找回密码共用同一套验证码邮件，
 *    验证码本身是通用的。早先这里带过一个 `scene` 参数想区分三种模板，
 *    经确认没必要 —— 多一个维度，后端就要多维护三套模板配置，而文案其实一模一样。
 *
 * @param {string} email 邮箱地址
 */
export async function sendEmailCode(email) {
  if (USE_MOCK) {
    await delay(300)
    console.info('[MOCK] 邮箱验证码：123456')
    return { code: '123456' }
  }
  // 用请求体而不是 query —— POST 带 query 参数不规范，参数里有邮箱也更该放 body 里
  return request({ url: '/auth/email/code', method: 'post', data: { email } })
}

/**
 * 获取算术验证码（密码登录前调用）
 *
 * 后端返回的是一道四则运算题的**纯文本**（如 `"3 + 5 = ?"`），不是图片，
 * 所以走普通 JSON 分支即可 —— 不需要 responseType、不用管 base64、
 * 也不用 URL.createObjectURL。
 *
 * @returns {Promise<{ enabled: boolean, captchaKey?: string, captchaQuestion?: string }>}
 *          enabled=false 时后端开关是关的，应隐藏验证码输入行
 *          captchaQuestion 是题目文本，直接显示即可
 */
export async function getCaptcha() {
  if (USE_MOCK) {
    await delay(200)
    console.info('[MOCK] 算术验证码：任意结果均可通过')
    return { enabled: true, captchaKey: 'mock-captcha-' + Date.now(), captchaQuestion: '3 + 5 = ?' }
  }
  return request({ url: '/auth/captcha', method: 'get' })
}

function countNodes(list) {
  return (list || []).reduce((sum, m) => sum + 1 + countNodes(m.children), 0)
}
