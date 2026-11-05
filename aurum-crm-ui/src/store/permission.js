import { defineStore } from 'pinia'

/**
 * 权限路由 store
 *
 * 职责：把后端返回的【菜单树】转换成 Vue Router 的【路由表】。
 *
 * 为什么菜单树不能直接当路由用：
 *   ① 菜单里有「目录」（menuType=1），它只是侧边栏的分组，不对应页面
 *   ② 菜单里有「按钮」（menuType=3），它是权限标识，更不是路由
 *   ③ 只有 menuType=2 的节点才产生路由
 *
 * 路由是【扁平】的（每条路由用绝对路径），不做父子嵌套 ——
 * 因为原型的一级导航里，线索/客户/商机/合同/产品都是独立顶级菜单，
 * 它们共用 /crm 前缀却互不从属，强行嵌套会导致路径拼接错误。
 * 侧边栏的层级单独由菜单树的 children 决定，与路由结构解耦。
 */

/**
 * 预扫描 src/views 下的所有组件。
 *
 * ⚠️ 必须用相对路径 `../views`，`import.meta.glob` 不支持 `@` 别名。
 * 返回的是 { '../views/crm/lead/index.vue': () => import(...) } 形式的懒加载函数表。
 */
const viewModules = import.meta.glob('../views/**/*.vue')

/**
 * 根据菜单的 component 字段找到对应组件。
 *
 * 支持两种写法：
 *   component = 'crm/lead/index'  → ../views/crm/lead/index.vue
 *   component = 'crm/lead'        → ../views/crm/lead/index.vue
 *
 * 找不到时回退到占位页 —— 骨架阶段大量页面尚未实现，
 * 这样动态菜单可以立刻跑通，不会因为缺组件而白屏。
 */
function loadView(component) {
  if (!component) return null

  const candidates = [
    `../views/${component}.vue`,
    `../views/${component}/index.vue`
  ]

  for (const key of candidates) {
    if (viewModules[key]) return viewModules[key]
  }

  console.warn(`[动态菜单] 未找到组件 "${component}"，已回退到占位页`)
  return () => import('@/views/_placeholder/index.vue')
}

/** 由路径生成路由 name（Vue Router 要求唯一） */
function toRouteName(path) {
  return (
    'Menu_' +
    path
      .replace(/^\//, '')
      .replace(/[/:]/g, '_')
      .replace(/\W/g, '')
  )
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    /** 由菜单树生成的路由（不含常驻路由） */
    dynamicRoutes: [],
    /** 侧边栏用的菜单树（已过滤掉按钮与隐藏项） */
    sidebarMenus: []
  }),

  actions: {
    /**
     * 由菜单树生成路由
     *
     * @param {Array} menus 后端返回的菜单树
     * @returns {Array} Vue Router 路由数组
     */
    generateRoutes(menus) {
      const routes = []

      const walk = (list) => {
        for (const menu of list || []) {
          // 只有「菜单」类型才产生路由；目录只是分组，按钮只是权限标识
          if (menu.menuType === 2 && menu.path) {
            const view = loadView(menu.component)
            if (view) {
              routes.push({
                path: menu.path,                 // 绝对路径，扁平注册
                name: toRouteName(menu.path),
                component: view,
                meta: {
                  title: menu.menuName,
                  icon: menu.icon,
                  menuId: menu.menuId,
                  perms: menu.perms,
                  // 组件路径传给占位页展示，方便定位「这个菜单该建哪个文件」
                  component: menu.component,
                  // visible=0 的页面（如详情页）可路由但不进侧边栏
                  hidden: menu.visible === 0
                }
              })
            }
          }
          if (menu.children?.length) walk(menu.children)
        }
      }

      walk(menus)

      // 开发期自检：把「路由路径 → 实际解析到的组件」打出来，并高声报告重复。
      //
      // 为什么需要它：菜单表配错（多条菜单指向同一个 component、或 component 里
      // 有错别字）时，症状是「点这个菜单却渲染出那个页面」—— 而地址栏是对的，
      // 于是排查时会一路去怀疑路由守卫、Layout、keep-alive，全是死路。
      // 这张表两秒就能定位：路径互不相同却解析到同一个组件 = 菜单数据配错了。
      //
      // 只在开发期执行（生产构建会被摇掉，不占体积也不刷日志）。
      if (import.meta.env.DEV) {
        const byComponent = new Map()
        for (const r of routes) {
          const key = r.meta?.component || '(回退到占位页)'
          if (!byComponent.has(key)) byComponent.set(key, [])
          byComponent.get(key).push(r.path)
        }

        console.groupCollapsed(`[动态菜单] 已生成 ${routes.length} 条路由（路径 → 组件）`)
        console.table(routes.map((r) => ({ 路径: r.path, 组件: r.meta?.component || '(占位页)' })))
        for (const [component, paths] of byComponent) {
          if (paths.length > 1) {
            console.error(
              `[动态菜单] ⚠️ 多条路由解析到同一个组件 "${component}"：${paths.join(' , ')}\n` +
                `  这是菜单配置错误 —— 检查 sys_menu 的 component 列（或用 npm run gen:menu 重新生成后比对）。` +
                `\n  症状就是「点 A 菜单却显示 B 页面」，且地址栏是正确的。`
            )
          }
        }
        const unresolved = routes.filter((r) => !r.meta?.component)
        if (unresolved.length) {
          console.warn(
            `[动态菜单] ${unresolved.length} 条路由回退到了占位页（component 为空或拼写错误）：` +
              unresolved.map((r) => r.path).join(' , ')
          )
        }
        console.groupEnd()
      }

      this.dynamicRoutes = routes
      this.sidebarMenus = this.buildSidebarMenus(menus)
      return routes
    },

    /**
     * 构造侧边栏菜单树
     *
     * 过滤规则：
     *   - 剔除按钮（menuType=3）—— 它们不是页面
     *   - 剔除 visible=0 的节点 —— 详情页等不应出现在菜单里
     *   - 目录下所有子项都被过滤掉时，该目录本身也不显示
     */
    buildSidebarMenus(menus) {
      const filter = (list) =>
        (list || [])
          .filter((m) => m.menuType !== 3)
          .filter((m) => m.visible !== 0)
          .map((m) => ({ ...m, children: filter(m.children) }))
          .filter((m) => m.menuType !== 1 || m.children.length > 0)

      return filter(menus)
    },

    /** 退出登录时清空 */
    resetRoutes() {
      this.dynamicRoutes = []
      this.sidebarMenus = []
    }
  }
})
