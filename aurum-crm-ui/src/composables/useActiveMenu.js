import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'

/**
 * 顶部一级导航 ↔ 左侧二级导航的联动状态
 *
 * 原型是三层结构：顶部一级导航（8 项）+ 左侧二级导航（当前模块的页面）。
 * 菜单树本身是两层的 —— 首页是顶级页面节点（没有 children），
 * 其余一级节点是目录，children 就是二级导航的条目。
 *
 * ⚠️ 查「当前属于哪个一级模块」必须用【完整菜单树】，不能用侧边栏菜单树。
 *    侧边栏树（permissionStore.sidebarMenus）已经滤掉了 visible=0 的节点，
 *    而客户详情、公海规则、操作日志这些隐藏页恰恰是 visible=0。
 *    拿过滤后的树去查，这些页面会一个都匹配不上 —— 表现就是进详情页后
 *    顶部导航不高亮、左侧栏整条消失。
 *    所以：完整树（userStore.menus）负责【查归属】，侧边栏树负责【渲染】。
 */
export function useActiveMenu() {
  const route = useRoute()
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()

  /** 一级导航的渲染条目（已滤掉隐藏项与按钮） */
  const topMenus = computed(() => permissionStore.sidebarMenus)

  /** 当前路由对应的菜单节点 id */
  const activeMenuId = computed(() => route.meta?.menuId)

  /**
   * 在完整菜单树里回溯出目标节点所属的【一级节点】menuId。
   *
   * 递归而不是写死两层 —— 菜单树将来加深也不会失效。
   */
  function findTopAncestorId(nodes, targetId, topId = null) {
    for (const node of nodes || []) {
      const currentTop = topId ?? node.menuId
      if (node.menuId === targetId) return currentTop
      const found = findTopAncestorId(node.children, targetId, currentTop)
      if (found != null) return found
    }
    return null
  }

  /** 当前所属的一级模块；找不到时返回 null（如 404 页、未登记路由） */
  const activeTop = computed(() => {
    const id = activeMenuId.value
    if (!id) return null

    const topId = findTopAncestorId(userStore.menus, id)
    if (topId == null) return null

    // 回到【渲染用】的树里取节点，这样 children 已是过滤后的侧栏条目
    return topMenus.value.find((top) => top.menuId === topId) || null
  })

  /** 左侧二级导航的条目；首页这类没有 children 的一级节点返回空数组，侧栏整体隐藏 */
  const subMenus = computed(() => activeTop.value?.children || [])

  return { topMenus, activeTop, subMenus, activeMenuId }
}
