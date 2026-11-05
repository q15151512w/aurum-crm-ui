/**
 * 后端项目目录定位（三个自检脚本共用）
 *
 * ## 为什么需要这个文件
 *
 * 脚本原先各自写死了 `path.resolve(import.meta.dirname, '../../aurum-crm/...')`，
 * 也就是假设「后端项目是 aurum-crm-ui 的同级目录」。但后端与前端常常是两个各自独立的
 * 仓库，实际布局至少有四种：
 *
 * ```
 *   crm_cp/crm-ui/aurum-crm/                    ← 布局 A：同级（脚本原本假设的）
 *
 *   crm_cp/
 *     crm/aurum-crm/                            ← 布局 B
 *     crm-ui/aurum-crm-ui/
 *
 *   crm_cp/
 *     aurum-crm/                                ← 布局 C：两个仓库并列
 *     crm-ui/aurum-crm-ui/
 *
 *   repo/
 *     master/crm/aurum-crm/                     ← 布局 D：本仓库当前检出
 *     ui/crm-ui/aurum-crm-ui/
 * ```
 *
 * 布局 B/C/D 下三个脚本一跑就「找不到后端项目目录」并 `exit 1` ——
 * 症状是「自检直接不可用」而不是「检查不通过」，很容易被当成环境问题跳过。
 * 所以改成本文件按候选列表探测，四种布局都能用，兜底还有一层逐级向上查找。
 *
 * ## 为什么不各写一份
 *
 * 见《开发注意事项》第 26 条：**同一段路径/抽取逻辑在两个脚本里各写一份，必然有一份
 * 先腐烂**。`check:api` 与 `gen:api-status` 的 url 抽取当初就是这么烂掉的。
 * 所以路径解析只留这一份，放在 `scripts/lib/` 下。
 *
 * ⚠️ 本文件**曾经单独存在过一个功能重复的副本 `backend-dir.js`**，两个文件做同一件事、
 *    只有一份被 import，另一份静默腐烂。合并时留下的教训：**动手前先搜 `scripts/lib/`**。
 */
import fs from 'node:fs'
import path from 'node:path'

/** `scripts/` 目录 —— 候选路径都以它为基准（本文件在 `scripts/lib/` 下，所以先回退一层） */
const SCRIPT_DIR = path.resolve(import.meta.dirname, '..')

/**
 * 判定「这个目录确实是后端项目」的标志文件。
 *
 * ⚠️ 判据是**文件存在**而不是「目录存在」：磁盘上留了半个项目、或有个同名的空目录时，
 *    只看目录会把它们当成后端，然后在下一步报「后端里找不到 xxx.sql」——
 *    错误信息指向了错误的方向。
 */
const MARKER = 'sql/crm.sql'

/**
 * 候选后端目录，按顺序取第一个**真的含有目标文件**的。
 *
 * ⚠️ 顺序有讲究：先试脚本原本假设的同级布局，这样在原本能跑的环境里行为完全不变；
 *    再逐个试其它布局。
 */
const CANDIDATES = [
  path.resolve(SCRIPT_DIR, '../../aurum-crm'), // 布局 A：crm-ui/aurum-crm（脚本原本假设的）
  path.resolve(SCRIPT_DIR, '../../../crm/aurum-crm'), // 布局 B：crm_cp/crm/aurum-crm
  path.resolve(SCRIPT_DIR, '../../../aurum-crm'), // 布局 C：crm_cp/aurum-crm
  path.resolve(SCRIPT_DIR, '../../../../master/crm/aurum-crm'), // 布局 D：repo/master/crm/aurum-crm
  // 布局 E：**双层 crm 嵌套** —— `<repo>/crm/crm/aurum-crm`（本机当前检出）
  //
  // ⚠️ 这条是「补回来的」：它曾经加过（见 docs/08-当前进度.md 的说明），
  //    但上面那次合并把它连同旧实现一起丢了 —— 于是本机布局下
  //    check:api / check:static / gen:api-status 又全部报「找不到后端项目」。
  //    症状具有欺骗性：看起来像环境问题，实际是探测列表少了一条。
  path.resolve(SCRIPT_DIR, '../../../../crm/crm/aurum-crm')
]

/**
 * 兜底候选：从 `scripts/` 逐级向上，在每一级找 `aurum-crm` 与 `master/crm/aurum-crm`。
 *
 * <p>有了它，**换任何目录结构都还能找到** —— 上面那 4 条只是「常见布局的快路径」，
 * 少写一层 `..` 之类的低级错误不会让脚本直接不可用。
 */
function fallbackCandidates() {
  const out = []
  let dir = SCRIPT_DIR
  for (let i = 0; i < 6; i++) {
    out.push(path.join(dir, 'aurum-crm'))
    out.push(path.join(dir, 'master', 'crm', 'aurum-crm'))
    // 双层 crm 嵌套：<dir>/crm/crm/aurum-crm。
    // ⚠️ 兜底列表也必须有它 —— 否则 CANDIDATES 里一旦少写一层 `..`
    //    （历史上发生过两次），兜底也救不回来，脚本直接整体不可用。
    out.push(path.join(dir, 'crm', 'crm', 'aurum-crm'))
    const parent = path.dirname(dir)
    if (parent === dir) break // 到盘符根了
    dir = parent
  }
  return out
}

/**
 * 全部候选，**环境变量排在最前**。
 *
 * `AURUM_BACKEND_DIR` 是唯一的显式覆盖口，三个脚本共用 —— 布局实在探测不到时用它，
 * 不必改代码。它取代了早先只存在于 `check:api` 里的 `CRM_DOC`（那个只能覆盖文档路径，
 * 换布局时另外两个脚本照旧跑不了）。
 */
function allCandidates() {
  return [process.env.AURUM_BACKEND_DIR, ...CANDIDATES, ...fallbackCandidates()].filter(Boolean)
}

/**
 * 后端项目根目录；找不到返回 null。
 *
 * 用标志文件判定，见 {@link MARKER} 的说明。
 */
export function backendRoot() {
  return allCandidates().find((dir) => fs.existsSync(path.join(dir, MARKER)))
}

/**
 * 取后端里的一个文件（如 `docs/05-接口文档.md`、`sql/crm.sql`）。
 *
 * 找不到时直接退出并打印**试过哪些路径** —— 只说「找不到」会让人以为是自己敲错了命令，
 * 把候选列表打出来，一看就知道是布局变了。
 *
 * 注意这里按**要取的那个文件**逐个候选去试，而不是先定根目录再拼路径：
 * 一个目录里可能只有 `sql/` 没有 `docs/`（半个项目），用文件本身当判据才准。
 */
export function backendFile(relativePath) {
  const root = allCandidates().find((dir) => fs.existsSync(path.join(dir, relativePath)))
  if (!root) {
    console.error(`找不到后端项目里存在 ${relativePath} 的目录，试过：`)
    for (const c of CANDIDATES) console.error('  · ' + c)
    console.error('  · 以及从 scripts/ 逐级向上查找 aurum-crm 与 master/crm/aurum-crm')
    console.error('（后端项目与 aurum-crm-ui 同级、或在 crm/ 或 master/crm/ 子目录下）')
    console.error('实在找不到就用环境变量指定后端根目录：')
    console.error('  AURUM_BACKEND_DIR=/path/to/aurum-crm npm run <命令>')
    process.exit(1)
  }
  return path.join(root, relativePath)
}
