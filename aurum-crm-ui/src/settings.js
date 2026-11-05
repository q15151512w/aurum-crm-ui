/**
 * 应用级配置
 *
 * 集中管理界面行为开关，避免散落在各组件里硬编码。
 */
export default {
  /** 应用标题（会拼接到浏览器标签页） */
  title: import.meta.env.VITE_APP_TITLE || 'AurumCRM',

  /**
   * 侧边栏主题：'dark' | 'light'
   */
  sidebarTheme: 'dark',

  /** 是否固定顶栏 */
  fixedHeader: true,

  /** 是否显示面包屑 */
  showBreadcrumb: true,

  /**
   * 是否显示标签页（多页签）
   * 骨架阶段先关掉，后续实现动态路由时再开
   */
  showTagsView: false,

  /** 登录页路径，token 失效时跳转到这里 */
  loginPath: '/login',

  /** 首页路径，登录成功后跳转 */
  homePath: '/dashboard'
}
