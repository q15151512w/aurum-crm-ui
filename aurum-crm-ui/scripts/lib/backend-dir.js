import fs from 'node:fs'
import path from 'node:path'

/**
 * 定位后端项目目录（aurum-crm）。
 *
 * <b>为什么需要这个模块</b>：原先 `gen-menu.js`、`gen-api-status.js`、
 * `check-api-align.js` **各自硬编码**了一份 `../../aurum-crm`，假定后端与
 * `aurum-crm-ui` 是同级目录。本仓库把后端放在 `master/crm/` 下，
 * 于是这三个脚本全都「找不到…」直接 exit 1 —— 而且同样的路径写了三遍，
 * 要改就得改三处，很容易漏掉一个（这正是本仓库一直跑不了它们的原因）。
 *
 * 现在改为**按顺序探测，第一个命中者胜出**：
 *   1. 环境变量 `AURUM_BACKEND_DIR` —— 显式指定优先，换布局时不必改代码
 *   2. 与 aurum-crm-ui 同级 —— 原始仓库布局
 *   3. `<仓库根>/master/crm/aurum-crm` —— 本仓库布局
 *   4. 从 ui 项目根逐级向上探测 `aurum-crm` / `master/crm/aurum-crm` /
 *      `crm/aurum-crm` / `crm/crm/aurum-crm` —— 兜底，覆盖各种嵌套深度
 *      （最后两种是 2026-09-14 补的：前端在 `crm-ui/crm-ui/aurum-crm-ui`、
 *       后端在 `crm/crm/aurum-crm` 的双层同名嵌套，原先探不到）
 *
 * 判据是「**目标文件**存在」而不是「目录存在」：只看目录的话，
 * 磁盘上留了半个项目（或有同名空目录）时会误判成找到了。
 *
 * @param {string} requiredRelPath 该后端必须具备的相对路径，如 `sql/crm.sql`
 * @returns {string|null} 后端目录绝对路径；全都没找到时返回 null
 */
export function resolveBackendDir(requiredRelPath) {
  // 本文件在 scripts/lib/ 下，向上一级是 scripts，再上一级才是 ui 项目根
  const uiRoot = path.resolve(import.meta.dirname, '../..')

  const candidates = [
    process.env.AURUM_BACKEND_DIR,
    // 原始布局：后端与 aurum-crm-ui 同级
    path.resolve(uiRoot, '../aurum-crm'),
    // 本仓库布局：<仓库根>/master/crm/aurum-crm
    path.resolve(uiRoot, '../../../master/crm/aurum-crm')
  ]

  // 兜底：从 ui 项目根逐级向上，探测常见位置
  //
  // ⚠️ 嵌套深度要探够。原来只探「同级」和「master/crm/」两种，
  //    而实际上还有一种 `.crm-ui/crm-ui/aurum-crm-ui` ↔ `crm/crm/aurum-crm`
  //    的双层同名嵌套布局 —— 那一层的脚本会直接报「找不到后端项目」，
  //    症状是**自检不可用**而不是「检查不通过」，很容易被当成环境问题跳过。
  //    所以这里把 `crm/`、`crm/crm/` 两种也纳入探测。
  let dir = uiRoot
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, 'aurum-crm'))
    candidates.push(path.join(dir, 'master', 'crm', 'aurum-crm'))
    candidates.push(path.join(dir, 'crm', 'aurum-crm'))
    candidates.push(path.join(dir, 'crm', 'crm', 'aurum-crm'))
    const parent = path.dirname(dir)
    if (parent === dir) break // 到盘符根了
    dir = parent
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, requiredRelPath))) {
      return candidate
    }
  }
  return null
}

/** 找不到后端时的统一提示，避免三个脚本各写一套文案。 */
export function reportMissingBackend(requiredRelPath) {
  console.error(`找不到后端项目（需要其中存在 ${requiredRelPath}）。`)
  console.error('已尝试：环境变量 AURUM_BACKEND_DIR、与 aurum-crm-ui 同级、<仓库根>/master/crm/aurum-crm，')
  console.error('以及从 ui 项目根逐级向上探测。')
  console.error('仍找不到时请显式指定，例如：')
  console.error('  AURUM_BACKEND_DIR=/path/to/aurum-crm npm run <命令>')
}
