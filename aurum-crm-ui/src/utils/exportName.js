/**
 * 导出文件名的统一规则：文件名 = 当前筛选胶囊的中文名。
 *
 * - scope === 'all'（默认「全部*」胶囊，即顶级菜单本身）→ 用页面标题 + 「导出」，
 *   例如客户页 → 「客户导出」；
 * - 其它子菜单胶囊（「我负责的」「我关注的」「审核中」…）→ 直接用胶囊的 label，
 *   例如「我的关注客户」。
 *
 * @param {Array<{label:string, value:string}>} filters 当前页的筛选胶囊数组
 * @param {string} scope 当前选中的胶囊 value（来自 listRef.getQuery().scope）
 * @param {string} title 页面标题（顶级菜单名的简称，如「客户」「合同」）
 * @returns {string} 文件名（不含扩展名）
 */
export function exportNameOf(filters, scope, title) {
  const hit = (filters || []).find((f) => f.value === scope)
  if (!hit) return title || '导出'
  if (scope === 'all') return `${title || hit.label}导出`
  return hit.label
}
