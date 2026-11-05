import { defineStore } from 'pinia'
import {
  login as loginApi,
  loginByEmail as loginByEmailApi,
  logout as logoutApi,
  getInfo
} from '@/api/auth'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { usePermissionStore } from '@/store/permission'

/**
 * 用户状态：登录凭证 + 用户信息 + 权限 + 菜单树
 */
export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    /** 用户信息，结构见 api/auth.js 的 getInfo */
    userInfo: null,
    /** 角色标识集合，如 ['sales'] */
    roles: [],
    /** 权限标识集合，如 ['crm:customer:list'] */
    permissions: [],
    /** 菜单树（后端按角色下发），前端据此生成路由与侧边栏 */
    menus: []
  }),

  getters: {
    isLogin: (state) => !!state.token,
    nickName: (state) => state.userInfo?.realName || state.userInfo?.username || '',
    deptName: (state) => state.userInfo?.deptName || ''
  },

  actions: {
    /** 密码登录 */
    async login(loginForm) {
      const data = await loginApi(loginForm)
      this.setLoginToken(data)
      return data
    },

    /** 邮箱验证码登录，与密码登录只差取 token 的那个接口 */
    async loginByEmail(form) {
      const data = await loginByEmailApi(form)
      this.setLoginToken(data)
      return data
    },

    /** 两种登录方式共用的收尾：拿 token 并持久化 */
    setLoginToken(data) {
      // 后端返回 { token: 'xxx' }
      const token = data?.token || data
      this.token = token
      setToken(token)
    },

    /**
     * 拉取用户信息（含菜单树与权限标识）
     *
     * 对应后端 GET /auth/me。菜单树是动态路由的数据源。
     */
    async fetchUserInfo() {
      const info = await getInfo()
      this.userInfo = info
      this.roles = info.roles || []
      this.permissions = info.permissions || []
      this.menus = info.menus || []
      return info
    },

    /**
     * 就地更新用户信息（改完「个人信息」后调）
     *
     * 为什么不直接再调一次 fetchUserInfo()：那会连**菜单树**一起重算，
     * 只为刷新顶栏上的一行名字和一个头像，代价太大；而且 /auth/me 是路由守卫
     * 用来判「token 还有效吗」的探针，不该被一次普通的表单保存反复触发。
     *
     * 只合并传进来的字段，其余保持原样 —— 调用方只需给改过的那几项。
     */
    updateUserInfo(partial) {
      this.userInfo = { ...this.userInfo, ...partial }
    },

    /** 退出登录 */
    async logout() {
      try {
        await logoutApi()
      } catch {
        // 后端退出失败也要清本地状态，否则用户会卡在「点了退出还在登录态」
      } finally {
        this.resetState()
      }
    },

    /**
     * 清空本地登录状态。
     *
     * 注意这里【不】直接调 resetRouter()——那会造成
     * router/index.js ↔ store/user.js 的循环依赖。
     * 由调用方（Layout 的退出逻辑）负责重置路由。
     */
    resetState() {
      this.token = null
      this.userInfo = null
      this.roles = []
      this.permissions = []
      this.menus = []
      usePermissionStore().resetRoutes()
      removeToken()
    },

    /**
     * 权限校验
     * @param {string} permission 权限标识，如 'crm:customer:create'
     */
    hasPermission(permission) {
      if (!permission) return true
      return this.permissions.includes('*:*:*') || this.permissions.includes(permission)
    }
  }
})
