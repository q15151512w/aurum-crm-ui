/**
 * 前端静态审查 —— 查「build 抓不到、又不需要开浏览器」的问题
 *
 * 为什么需要它：build 只保证语法与 import 能解析，下面这些问题它一个都不报，
 * 而它们全都是本项目真实踩过的（括号里是当时的症状）：
 *
 *   · 模板里的事件处理器名写错        （运行时才报 is not a function）
 *   · 模板里用了没 import 的组件      （渲染成未知标签）
 *   · 表单字段的 type 在 FormField 里没有对应控件（静默渲染成兜底输入框）
 *   · 选择器 key 在注册表里不存在     （弹窗打开是空的）
 *   · 图标名写错                      （渲染成一块空白）
 *   · 路由路径写错                    （跳 404）
 *   · useFormDialog 解构了它没返回的名字
 *   · onAction 用了 rows 却没解构     （点「编辑」直接 ReferenceError）
 *   · FIELDS 的 prop 没进 emptyForm   （编辑回填静默丢字段）
 *   · api 写操作的 mock 分支没落库    （弹「保存成功」但数据没变）
 *   · api 层裸用 ElMessage 但没 import（又是 ReferenceError）
 *
 * 用法：
 *   npm run check:static
 *
 * ⚠️ 这些检查靠正则实现，**写正则时务必用「多行 + 单行」两种写法各试一次** ——
 *    本脚本自己就因为只考虑多行写法而误报过两轮。
 */
import fs from 'node:fs'
import path from 'node:path'
import { readApiCalls } from './lib/api-calls.js'

// 统一从项目根目录出发，别依赖调用者的 cwd（npm run 时 cwd 就是根目录，但直接 node 跑不是）
const ROOT = path.resolve(import.meta.dirname, '..')
process.chdir(ROOT)

const read = (f) => fs.readFileSync(f, 'utf8')

/**
 * 递归收集目录下指定后缀的文件，返回**相对 ROOT 的路径**（正斜杠）
 *
 * ⚠️ 这里原本是 `execSync('find src -name "*.vue"')`，有两个问题，都会让检查器**完全跑不起来**：
 *
 *   1. **Windows 上没有 GNU find。** PATH 里的 `find` 是 `C:\Windows\system32\find.exe` ——
 *      一个完全不同的程序（在文件里搜文本），它会以
 *      「Access denied - SRC / File not found - -NAME」失败。报错出现在脚本自身，
 *      看起来像环境问题，于是这个自检在 Windows 上**从来没被执行过**。
 *   2. **execSync 默认用管道捕获子进程输出**，在受限 shell 里会
 *      `EPERM: spawnSync C:\Windows\system32\cmd.exe`。
 *
 * 换成 fs 递归，两个问题一起消失，也不再需要任何外部命令。
 */
const walk = (dir, exts) => {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.posix.join(dir.replace(/\\/g, '/'), entry.name)
    if (entry.isDirectory()) out.push(...walk(full, exts))
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

/** 表单/组件/布局里可能声明 FIELDS 的文件 */
const files = (dir) => walk(dir, ['.vue', '.js'])

const VUE = walk('src', ['.vue'])
const ALL = [...files('src/views'), ...files('src/components'), ...files('src/layout')]

let problems = 0
const report = (title, rows) => {
  console.log(`${rows.length ? '✗' : '✓'} ${title}${rows.length ? `  —— ${rows.length} 处` : ''}`)
  for (const r of [...new Set(rows)].slice(0, 12)) console.log('   · ' + r)
  if (rows.length > 12) console.log(`   … 另有 ${rows.length - 12} 处`)
  problems += rows.length
}

/** 取文件里所有 `const X_FIELDS = [ ... ]` 的数组体 */
const fieldBlocks = (src) =>
  [...src.matchAll(/const (\w*FIELDS\w*) = \[([\s\S]*?)\n\]/g)].map((m) => m[2])

// ---------------------------------------------------------------------------
// 1. 表单字段 type 都有对应控件
// ---------------------------------------------------------------------------
const ff = read('src/components/form/FormField.vue')
const supported = new Set([...ff.matchAll(/v-(?:else-)?if="type === '(\w+)'"/g)].map((m) => m[1]))
supported.add('input')
const badTypes = []
for (const f of ALL) {
  for (const b of fieldBlocks(read(f))) {
    for (const m of b.matchAll(/^\s+type: '(\w+)'/gm)) {
      if (!supported.has(m[1])) badTypes.push(`${m[1]}  (${f})`)
    }
  }
}
report('表单字段 type 都有对应控件', badTypes)

// ---------------------------------------------------------------------------
// 2. selector key 都在注册表里
// ---------------------------------------------------------------------------
const registryKeys = new Set(
  [...read('src/constants/selectorRegistry.js').matchAll(/^  (\w+):/gm)].map((m) => m[1])
)
const badSel = []
for (const f of ALL) {
  for (const b of fieldBlocks(read(f))) {
    for (const m of b.matchAll(/selector: '(\w+)'/g)) {
      if (!registryKeys.has(m[1])) badSel.push(`${m[1]}  (${f})`)
    }
  }
}
report('selector key 都在注册表里', badSel)

// ---------------------------------------------------------------------------
// 3. 看板图标名存在
// ---------------------------------------------------------------------------
const iconNames = new Set(
  read('node_modules/@element-plus/icons-vue/dist/index.js')
    .match(/export\s*\{([\s\S]*?)\}\s*;?\s*$/)
    .at(1)
    .split(',')
    .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
    .filter(Boolean)
)
report(
  '看板图标名都存在',
  [...new Set([...read('src/views/dashboard/constants.js').matchAll(/icon: '(\w+)'/g)].map((m) => m[1]))].filter(
    (n) => !iconNames.has(n)
  )
)

// ---------------------------------------------------------------------------
// 4. 代码里写死的路由路径都存在（菜单 + 静态路由）
// ---------------------------------------------------------------------------
const routes = new Set([...read('src/mock/menu.js').matchAll(/path: "([^"]+)"/g)].map((m) => m[1]))
for (const m of read('src/router/index.js').matchAll(/path: '([^']+)'/g)) routes.add(m[1])
const badPaths = []
for (const f of ALL) {
  const s = read(f)
  for (const m of s.matchAll(/(?:^|\s)path: '(\/[a-z0-9/_-]+)'/gm)) {
    if (!routes.has(m[1])) badPaths.push(`${m[1]}  (${f})`)
  }
  for (const m of s.matchAll(/router\.push\('(\/[a-z0-9/_-]+)'\)/g)) {
    if (!routes.has(m[1])) badPaths.push(`${m[1]}  (${f})`)
  }
}
report('写死的路由路径都存在', badPaths)

// ---------------------------------------------------------------------------
// 5. useFormDialog 解构名是它返回的
// ---------------------------------------------------------------------------
const returned = new Set(
  read('src/composables/useFormDialog.js')
    .match(/return \{([\s\S]*?)\n  \}/)[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)
const badDe = []
for (const f of ALL) {
  for (const m of read(f).matchAll(/const\s*\{([^{}]*)\}\s*=\s*useFormDialog\(/g)) {
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(':')[0].trim() // 冒号左边才是源名
      if (n && !returned.has(n)) badDe.push(`${n}  (${f})`)
    }
  }
}
report('useFormDialog 解构名正确', badDe)

// ---------------------------------------------------------------------------
// 6. onAction 用了 rows 就得解构 rows
// ---------------------------------------------------------------------------
const badRows = []
for (const f of ALL) {
  const s = read(f)
  const m = s.match(/function onAction\(\{([^}]*)\}/)
  if (!m || m[1].includes('rows')) continue
  if (/\brows\b/.test(s.slice(s.indexOf(m[0])))) badRows.push(f)
}
report('onAction 的 rows 解构正确', badRows)

// ---------------------------------------------------------------------------
// 7. api 层不要直接依赖 UI 库（顶层 import）
// ---------------------------------------------------------------------------
const badUi = []
for (const f of files('src/api')) {
  const s = read(f)
  if (/ElMessage|ElMessageBox/.test(s) && !/import .*element-plus/.test(s) && !/import\(['"]element-plus/.test(s)) {
    badUi.push(f)
  }
}
report('api 层没有裸用 UI 提示', badUi)

// ---------------------------------------------------------------------------
// 8. 【新】模板里的 @事件处理器 必须在 script 里定义
// ---------------------------------------------------------------------------
const DECL = /(?:const|let|var|function)\s+(\w+)|(?:const|let)\s*\{([^}]*)\}\s*=|import\s+(\w+)\s+from|import\s*\{([^}]*)\}\s*from/g
/** Vue/EP 的内建与全局，不算未定义 */
const GLOBALS = new Set([
  '$emit', '$refs', '$attrs', '$slots', '$props', 'true', 'false', 'null', 'undefined',
  '$event', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'console', 'window', 'document', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'Promise', 'Error', 'Set', 'Map', 'RegExp', 'parseInt', 'parseFloat', 'isNaN', 'Number'
])
const badHandlers = []
for (const f of VUE) {
  const s = read(f)
  const sm = s.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)
  if (!sm) continue
  const script = sm[1]
  const declared = new Set()
  for (const m of script.matchAll(DECL)) {
    if (m[1]) declared.add(m[1])
    if (m[3]) declared.add(m[3])
    // 解构要**两边都登记**：`{ submit: submitContact }` 里 submit 是源名、submitContact 是别名，
    // 模板里用的可能是任意一边。只取一侧就会误报（这里踩过一次）。
    for (const grp of [m[2], m[4]]) {
      if (!grp) continue
      for (const part of grp.split(',')) {
        for (const piece of part.trim().split(/[:]/)) {
          const n = piece.trim()
          if (/^\w+$/.test(n)) declared.add(n)
        }
      }
    }
  }
  // 模板里 @click="foo" / @change="foo" 这种裸标识符（不是表达式）
  const tpl = s.slice(0, s.indexOf('<script'))
  for (const m of tpl.matchAll(/@[\w:.]+(?:\.\w+)?="([\w$]+)"/g)) {
    const n = m[1]
    if (!declared.has(n) && !GLOBALS.has(n)) badHandlers.push(`${n} 未定义  (${f})`)
  }
}
report('模板事件处理器都在 script 里定义', badHandlers)

// ---------------------------------------------------------------------------
// 9. 【新】模板里用到的自定义组件都 import 了
// ---------------------------------------------------------------------------
const badComp = []
// Vue 与 vue-router 的**全局注册**组件，不用自己 import
const GLOBAL_COMPONENTS = new Set([
  'router-view', 'router-link', 'transition', 'transition-group',
  'keep-alive', 'component', 'teleport', 'suspense', 'slot'
])
for (const f of VUE) {
  const s = read(f)
  const sm = s.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)
  if (!sm) continue
  const imported = new Set([...sm[1].matchAll(/import\s+(\w+)\s+from/g)].map((m) => m[1]))
  const tpl = s.slice(0, s.indexOf('<script'))
  // 只看带连字符的自定义标签（kebab-case），el-* 是 Element Plus 全局注册，跳过
  for (const m of tpl.matchAll(/<([a-z][\w]*(?:-[\w]+)+)[\s/>]/g)) {
    const tag = m[1]
    if (GLOBAL_COMPONENTS.has(tag)) continue
    if (tag.startsWith('el-')) continue
    const pascal = tag.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('')
    if (!imported.has(pascal)) badComp.push(`<${tag}> → ${pascal} 未 import  (${f})`)
  }
}
report('模板里的自定义组件都已 import', badComp)

// ---------------------------------------------------------------------------
// 10. FIELDS 的 prop 都被 emptyForm 覆盖
// ---------------------------------------------------------------------------
// ⚠️ 一个文件里可能有多个 FIELDS + 多个 emptyForm（客户详情就有三对：
//    客户 / 联系人 / 开票信息）。必须**就近配对**——早先只取第一个 emptyForm，
//    拿客户的空表单去比开票信息的字段，报了一堆假问题。
const badEmpty = []
for (const f of ALL) {
  const s = read(f)
  // 收集所有 emptyForm 出现的位置与键
  const empties = []
  for (const m of s.matchAll(/emptyForm(?::\s*\(\)\s*=>\s*\(|\s*=\s*\(\)\s*=>\s*\()\{/g)) {
    // 从 `{` 开始做括号配平，取到对应的 `}`
    let depth = 0
    let i = s.indexOf('{', m.index)
    const start = i
    for (; i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const body = s.slice(start + 1, i)
    // ⚠️ 别用 `^\s+(\w+):`（只匹配多行写法）：这些 emptyForm 大多是单行的
    //    `() => ({ result: 1, comment: '' })`，那样一个键都取不到。
    //    改成「对象的开头或逗号之后」跟着的键名。
    const keys = [...body.matchAll(/(?:^|[,{])\s*(\w+)\s*:/g)].map((x) => x[1])
    empties.push({ at: m.index, keys })
  }
  if (!empties.length) continue

  for (const bm of s.matchAll(/const (\w*FIELDS\w*) = \[/g)) {
    const props = [...fieldBlocks(s).find((b) => s.indexOf(b) > bm.index)?.matchAll(/prop: '([^']+)'/g) || []].map(
      (x) => x[1]
    )
    if (!props.length) continue
    // 就近配对：取这个 FIELDS 之后（或之前）最近的那个 emptyForm
    const after = empties.filter((e) => e.at > bm.index).sort((x, y) => x.at - y.at)[0]
    const before = empties.filter((e) => e.at < bm.index).sort((x, y) => y.at - x.at)[0]
    const pair = after ?? before
    if (!pair) continue
    const notIn = props.filter((p) => !pair.keys.includes(p))
    if (notIn.length) badEmpty.push(`${f} [${bm[1]}] → emptyForm 缺 ${notIn.join(', ')}`)
  }
}
report('每个 FIELDS 的 prop 都被对应的 emptyForm 覆盖', badEmpty)

// ---------------------------------------------------------------------------
// 11. api 写操作的 mock 分支真的落库
// ---------------------------------------------------------------------------
const WRITE = /^(create|update|submit|assign|claim|set|change|onShelf|offShelf|issue|audit|batch|convert|remove|delete|ToPool)/

/**
 * 已确认「不需要写库」的写操作 —— 每一条都要写清原因，别当成随手加的例外
 */
const MOCK_WRITE_ALLOW = new Map([
  ['changePassword', 'mock 的 user 行里没有 password 字段，无处可写；真实后端会真的改密码'],
  ['createWriteOff', '核销：没有任何界面调用它（功能未做），不是「假成功」'],
  ['deleteFile', '附件删除：没有任何界面调用它（附件 UI 未做）'],
  // ⚠️ 下面三个用的是 `mockNotImplemented(...)`：它会 reject 并**明确提示**
  //    「该接口尚未实现（当前为 MOCK 模式）」。这是**诚实地失败**，
  //    与这条检查要抓的「弹『保存成功』但数据没变」那种**静默假成功**是两回事。
  //    （漏加这三条会让 check:static 长期报 3 处假问题，久了就没人看这条检查了。）
  ['createNotice', 'mock 下走 mockNotImplemented：显式报「尚未实现」，不是静默假成功'],
  ['updateNotice', '同上'],
  ['deleteNotice', '同上']
])
const badMock = []
for (const f of files('src/api')) {
  if (f.endsWith('_mock.js')) continue
  const s = read(f)
  for (const m of s.matchAll(/export (?:async )?function (\w+)\([\s\S]*?\)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = m
    if (!WRITE.test(name) || !body.includes('if (USE_MOCK)')) continue
    if (MOCK_WRITE_ALLOW.has(name)) continue
    const i = body.indexOf('if (USE_MOCK)')
    const mockPart = body.slice(i, body.indexOf('\n  }', i) + 1 || undefined)
    if (!/(insertRow|updateById|insertTreeNode|updateTreeNode|removeById|removeByIds|removeTreeNode|\.splice|\.unshift|\.push|\.forEach)/.test(mockPart)) {
      badMock.push(`${name}()  (${path.basename(f)})`)
    }
  }
}
report('api 写操作的 mock 分支真的落了库', badMock)

// ---------------------------------------------------------------------------
// 12. 前端请求全部可静态解析
// ---------------------------------------------------------------------------
const { calls, errors, skipped } = readApiCalls(path.resolve('src/api'))
report('前端请求全部可静态解析', [
  ...errors.map((e) => `${e.file}: ${e.reason}`),
  ...(skipped ? [`${skipped} 个复杂表达式无法解析`] : [])
])

// ---------------------------------------------------------------------------
// 13. 字典常量只能由 useDictOptions 引入
// ---------------------------------------------------------------------------
// 这些常量的定位是**数据字典的兜底种子**，真正的数据源是
// `GET /system/dict-data/batch`（见 composables/useDictOptions.js）。
// 页面直接 import 它们的话，那个下拉会永远停在种子值上 ——
// 管理员在「字典管理」页改了字典，页面纹丝不动，**且不报任何错**。
//
// 只靠文件头注释拦不住（这项目的注释已经腐烂过好几轮），所以加一条机制检查：
// 唯一的合法引入点是 composables/useDictOptions.js（它在 ALL 之外，不参与本检查）。
//
// ⚠️ 状态机枚举常量（GENDER_OPTIONS / DATA_SCOPE_OPTIONS / OPPORTUNITY_STAGE_OPTIONS…）
//    不在黑名单里 —— 那些值写死在 Java 枚举/DDL 里，页面就该直接 import。
const DICT_SEED_NAMES = new Set([
  'CUSTOMER_SOURCE_OPTIONS',
  'CUSTOMER_INDUSTRY_OPTIONS',
  'CUSTOMER_LEVEL_CODE_OPTIONS',
  'DEAL_STATUS_CODE_OPTIONS',
  'CONTRACT_TYPE_CODE_OPTIONS',
  'INVOICE_TYPE_OPTIONS',
  'PAYMENT_METHOD_CODE_OPTIONS',
  'POOL_REASON_CODE_OPTIONS'
])
const badDictImport = []
for (const f of ALL) {
  const s = read(f)
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/constants\/options'/g)) {
    const hit = m[1]
      .split(',')
      .map((x) => x.trim().split(/\s+as\s+/)[0].trim())
      .filter((n) => DICT_SEED_NAMES.has(n))
    if (hit.length) badDictImport.push(`${f} → ${hit.join(', ')}（请改用 dictOptions/useDictMap/dictLabel）`)
  }
}
report('页面没有直接 import 字典常量（应走 useDictOptions）', badDictImport)

console.log('\n' + '='.repeat(58))
console.log(problems ? `发现 ${problems} 处可疑问题` : '全部通过')
if (problems) process.exitCode = 1
console.log(`（静态解析出 ${calls.length} 个请求）`)
