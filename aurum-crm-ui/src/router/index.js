import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '@/layout/index.vue'
import settings from '@/settings'
import { getToken } from '@/utils/auth'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { ensureDictOptions } from '@/composables/useDictOptions'

/**
 * 常驻路由（无需权限、不依赖菜单数据）
 *
 * 登录页与错误页不套 Layout，所以放在这里而不是动态路由里。
 * 其余所有业务路由都由后端菜单树动态生成，见 store/permission.js。
 */
export const constantRoutes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', hidden: true }
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', hidden: true }
  }
]

/** 承载所有业务页面的框架路由名，动态路由挂到它下面 */
const LAYOUT_ROUTE_NAME = 'LayoutRoot'

const router = createRouter({
  // hash 模式：部署时不需要 Nginx 配 try_files，刷新页面不会 404
  history: createWebHashHistory(),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 })
})

// ============================================================================
//  全局前置守卫
// ============================================================================
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  document.title = to.meta?.title ? `${to.meta.title} - ${settings.title}` : settings.title

  // ---------- 未登录 ----------
  if (!getToken()) {
    if (to.path === settings.loginPath) {
      next()
    } else {
      next(`${settings.loginPath}?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    return
  }

  // ---------- 已登录，访问登录页 → 回首页 ----------
  if (to.path === settings.loginPath) {
    next({ path: settings.homePath })
    return
  }

  // ---------- 已登录但路由还没生成 → 拉用户信息并动态注册路由 ----------
  if (permissionStore.dynamicRoutes.length === 0) {
    try {
      // ① 拉取用户信息（含菜单树与权限标识）
      await userStore.fetchUserInfo()

      // ①.5 字典缓存预热（不 await）
      //
      // 放这里而不是 main.js：这是全应用唯一的「首次进入、只跑一次」点
      // （由上面的 dynamicRoutes.length === 0 把关；下面 next({...to, replace:true})
      //  会重进守卫，但那一轮判定为 false，不会重复触发）。
      // main.js 里拿不到「已登录」这个上下文，未登录也会打一次接口 —— 必 401，
      // 在登录页上弹一条网络错误很难看。
      //
      // ⚠️ 刻意**不 await**：字典只决定下拉里的文字，拿不到也不该拖慢首次导航
      //    （本块已经 await 过一次 fetchUserInfo 了）。ensureDictOptions 内部吞异常，
      //    且 constants/options.js 的种子就是缓存初值，页面照常可用。
      //    不 await 也能让它和下面 ②③ 的路由注册并行起来。
      ensureDictOptions()

      // ② 先注册 Layout 容器路由（空的 children，稍后挂载）
      if (!router.hasRoute(LAYOUT_ROUTE_NAME)) {
        router.addRoute({
          path: '/',
          name: LAYOUT_ROUTE_NAME,
          component: Layout,
          redirect: settings.homePath,
          children: []
        })
      }

      // ③ 由菜单树生成业务路由，逐条挂到 Layout 下
      const routes = permissionStore.generateRoutes(userStore.menus)
      routes.forEach((route) => router.addRoute(LAYOUT_ROUTE_NAME, route))

      // ③.5 AI 小助手（整页版）—— 它**不是菜单页**，所以要在这里静态注册。
      //
      // 为什么不在 sys_menu 里建一条 menu_type=2 的记录：菜单里那条（menu_id=80/8001）
      // 是「目录 + 按钮」的组合，只承载权限点 `ai:chat:use`，本来就不产生路由
      // （generateRoutes 只处理 menuType===2 且有 path 的节点）。
      // 把它改成页面会让顶栏多出一个由后端驱动的菜单项，与「顶栏那个入口是前端控制的」
      // 现状冲突 —— 静态注册更简单，也不会动到线上库的菜单数据。
      //
      // meta.perms 交给下面的「页面级权限兜底」把关：没权限的人手敲 URL 会被送到 /404。
      router.addRoute(LAYOUT_ROUTE_NAME, {
        path: '/ai/chat',
        name: 'AiChat',
        component: () => import('@/views/ai/index.vue'),
        meta: { title: 'AI小助手', perms: 'ai:chat:use' }
      })

      // ③.6 个人信息页 —— 同 AI 页一样**不是菜单页**，静态注册。
      // 顶栏用户下拉的「个人信息」跳这里（原型是整页只读展示，不再用弹窗）。
      // 不带 meta.perms：看自己的资料不需要任何权限标识。
      router.addRoute(LAYOUT_ROUTE_NAME, {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人信息' }
      })

      // ④ 兜底 404 —— 必须【最后】添加，否则会把未注册的路径都吃掉
      //
      // ⚠️ 必须带 name：匿名路由进不了 vue-router 的 matcherMap，
      //    resetRouter() 里的 removeRoute(catchAll.name) 实际是 removeRoute(undefined)，
      //    只会打一句 "Cannot remove non-existent route" 就返回，兜底路由会一直残留。
      //
      // ⚠️ 必须用 component 而不是 redirect：record 级的 redirect 由
      //    pushWithRedirect() 里的 handleRedirectRecord() 解析，时机在 beforeEach【之前】，
      //    守卫拿到的 to.path 已经被改写成 /404，来不及注册新账号的路由，
      //    于是换账号后第一次登录必定停在 404（详见 docs/开发注意事项.md 第 30 条）。
      router.addRoute({
        path: '/:pathMatch(.*)*',
        name: 'CatchAll',
        component: () => import('@/views/error/404.vue'),
        meta: { title: '页面不存在', hidden: true }
      })

      // ⑤ 路由表已变化，重新进入本次导航（replace 避免历史记录里多一条）
      next({ ...to, replace: true })
    } catch (e) {
      console.error('[路由] 生成动态路由失败', e)
      userStore.resetState()
      permissionStore.resetRoutes()
      next(`${settings.loginPath}?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    return
  }

  // ---------- 页面级权限兜底 ----------
  //
  // 未授权的菜单根本不会生成路由，用户手动敲 URL 会落到兜底的 /:pathMatch(.*)* → /404，
  // 所以这一道是「第二层」—— 防的是「路由在、但当前用户没有对应权限标识」的情况
  // （比如菜单被改了、或者某个隐藏页没挂在菜单树下）。
  //
  // ⚠️ 必须放在上面「动态路由生成」那个分支【之后】：
  //    首次导航时路由还没生成，to.meta 是空的，此时校验毫无意义；
  //    next({...to, replace: true}) 会重新进守卫，那一次的 to.meta.perms 才是真实值。
  //
  // perms 为空就放行（/login、/404、Layout 容器路由都没有 meta.perms）。
  const requiredPerms = to.meta?.perms
  if (requiredPerms && !userStore.hasPermission(requiredPerms)) {
    console.warn(`[路由] 无权限访问 ${to.fullPath}，需要权限：${requiredPerms}`)
    next('/404')
    return
  }

  next()
})

/**
 * 退出登录时重置路由
 *
 * Vue Router 没有「移除所有动态路由」的 API，
 * 只能移除 LayoutRoot（其 children 会随之消失），再重新加入常驻路由。
 */
export function resetRouter() {
  if (router.hasRoute(LAYOUT_ROUTE_NAME)) {
    router.removeRoute(LAYOUT_ROUTE_NAME)
  }
  // 移除兜底 404
  const catchAll = router.getRoutes().find((r) => r.path === '/:pathMatch(.*)*')
  if (catchAll) router.removeRoute(catchAll.name)
}

export default router
