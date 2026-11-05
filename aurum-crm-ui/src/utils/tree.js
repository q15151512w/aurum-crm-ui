/**
 * 树形数据的小工具
 *
 * 部门（sys_dept）和产品分类（crm_product_category）都是自关联树，
 * 组件与 mock 都要按 id 找节点，逻辑放一处避免两边漂移。
 */

/**
 * 按 id 在树里找节点（深度优先）
 * @returns {Object|null}
 */
export function findTreeNode(tree, id) {
  if (id === null || id === undefined || !Array.isArray(tree)) return null

  for (const node of tree) {
    if (String(node.id) === String(id)) return node
    if (node.children?.length) {
      const hit = findTreeNode(node.children, id)
      if (hit) return hit
    }
  }
  return null
}

/** 拍平成数组（便于做全量 id 比对、搜索等） */
export function flattenTree(tree, result = []) {
  for (const node of tree || []) {
    result.push(node)
    if (node.children?.length) flattenTree(node.children, result)
  }
  return result
}
