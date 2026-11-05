import { computed, reactive } from 'vue'
import { getDictDataBatch } from '@/api/system'
import {
  CUSTOMER_SOURCE_OPTIONS,
  CUSTOMER_INDUSTRY_OPTIONS,
  CUSTOMER_LEVEL_CODE_OPTIONS,
  DEAL_STATUS_CODE_OPTIONS,
  CONTRACT_TYPE_CODE_OPTIONS,
  INVOICE_TYPE_OPTIONS,
  PAYMENT_METHOD_CODE_OPTIONS,
  POOL_REASON_CODE_OPTIONS
} from '@/constants/options'

/**
 * 数据字典选项（`sys_dict_data` 的前端缓存）
 *
 * 背景：字典以前在前端是**硬编码常量**（`constants/options.js`），后端 `sys_dict_data`
 * 是另一份，两边已经真实漂移出 bug —— 回款方式有 4 份互不相同的副本，
 * 选「支付宝」提交必挂；公海原因在客户池和线索池显示成两个词。
 * 现在统一以 `GET /system/dict-data/batch` 为准。
 *
 * ⚠️ **页面不要直接 import `constants/options.js` 里的字典常量**，一律通过本文件取数。
 * 直接 import 会让那个下拉永远停在种子值上（管理员在字典管理页改了也看不到），
 * 且不报任何错。这条有 `scripts/check-static.mjs` 的规则兜着。
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  三种消费形态（对应页面里实际存在的三种用法）
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   dictOptions(type)        → 裸数组，给表单/筛选的 options 和 v-for
 *   useDictMap(type)         → computed 的 { 码值: 标签 }，给列表 #cell slot、详情
 *   dictLabel(type, value)   → 单个值取标签，给列的 format、详情单行
 *
 * 缓存：模块级单例 + 在途 Promise 去重 —— 应用启动预热一次，
 * 之后每个页面再 ensure 都是零请求。写法与 `useUnitOptions.js` 同构。
 */

/**
 * 字典类型 → 业务侧期望的 JS 值类型
 *
 * ⚠️ **这张表是本文件存在的核心理由之一。**
 *
 * 后端 `DictDataRespVO.value` 是 **String**（如 `"1"`，因为字典管理页编辑时要按
 * 字符串存回去），而业务 DTO 里这些字段是 **Integer**。不转换的话：
 *   - el-select 的 v-model 是数字 1、option 的 value 是字符串 "1" → **回显空白**
 *   - `row.dealStatus === 2` 之类的比较恒为 false
 * 两者都是**静默失败**：不报错、不崩，只是看起来「没生效」。
 * 项目已经踩过同一个坑（见 `mock/db.js` 里发票类型那段注释）。
 *
 * 归一化只在**写缓存的唯一入口**做一次，三种消费形态拿到的都是同一份已归一化数组 ——
 * 这比在 11 个页面里各处 `Number()` 可靠得多（漏一处的症状是静默的）。
 *
 * 表里**没登记的类型默认不转**（保守方向），避免把真的字符串字典
 * （`LEAD` / `group` 这类）误转成 `NaN`。
 */
export const DICT_VALUE_TYPE = {
  crm_source: 'number',
  crm_industry: 'number',
  crm_customer_level: 'number',
  crm_deal_status: 'number',
  crm_contract_type: 'number',
  fin_invoice_type: 'number',
  fin_payment_method: 'number',
  crm_pool_reason: 'number'
}

/** 全部字典类型编码 —— 供路由守卫一次性预热 */
export const ALL_DICT_TYPES = Object.keys(DICT_VALUE_TYPE)

/**
 * 兜底种子
 *
 * 内容 = `constants/options.js` 里那份（出处同为 `sql/crm.sql` 的 `sys_dict_data`）。
 * 它**只在「接口还没回来」或「接口失败」时生效** —— 见 `flush()` 里的说明，
 * 一次成功的空响应不会被它覆盖。
 */
const DICT_FALLBACK = {
  crm_source: CUSTOMER_SOURCE_OPTIONS,
  crm_industry: CUSTOMER_INDUSTRY_OPTIONS,
  crm_customer_level: CUSTOMER_LEVEL_CODE_OPTIONS,
  crm_deal_status: DEAL_STATUS_CODE_OPTIONS,
  crm_contract_type: CONTRACT_TYPE_CODE_OPTIONS,
  fin_invoice_type: INVOICE_TYPE_OPTIONS,
  fin_payment_method: PAYMENT_METHOD_CODE_OPTIONS,
  crm_pool_reason: POOL_REASON_CODE_OPTIONS
}

/**
 * 缓存。**初值就是兜底种子** —— 首屏渲染时下拉已经有选项，接口回来再整体替换。
 * 用 `reactive` 而不是 `ref`：消费侧要的是 `store[type]` 这个数组本身，
 * 返回裸数组才能被 `v-for` 直接遍历（原因见 `dictOptions` 的注释）。
 */
const store = reactive(
  Object.fromEntries(ALL_DICT_TYPES.map((t) => [t, DICT_FALLBACK[t] || []]))
)

/** 已经拿到过服务端结果的类型。空数组也是有效结果，不能用 length 判断，否则会反复重试 */
const loadedTypes = new Set()

/** 本次在途请求要捎带的类型 */
const pending = new Set()

/** 在途请求，用于并发去重 */
let inflight = null

/**
 * 码值归一化：`"1"` → `1`
 *
 * 脏码值（非数字）**原样放行**而不是返回 NaN —— 一个 NaN 会让整份 map 烂掉，
 * 原样放行至少能让人在页面上看见那个值、知道库里有什么问题。
 */
function cast(raw, type) {
  if (DICT_VALUE_TYPE[type] !== 'number') return raw
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    console.error('[useDictOptions] 字典码值不是数字，按原样保留', type, raw)
    return raw
  }
  return n
}

/**
 * 确保若干字典类型已加载。
 *
 * 可以随便调，重复调用不会重复发请求：
 *   - 已加载过 → 立即返回
 *   - 预热在途 → 类型进 pending，由 `flush()` 的 while 循环捎上，共用同一个请求
 *   - 之前失败过 → 真的再试一次（失败要能自愈），期间页面用兜底种子照常渲染
 *
 * @param {string[]} [types] 缺省为全部类型
 */
export async function ensureDictOptions(types = ALL_DICT_TYPES) {
  const need = types.filter((t) => DICT_VALUE_TYPE[t] && !loadedTypes.has(t))
  if (!need.length) return
  need.forEach((t) => pending.add(t))
  if (!inflight) inflight = flush()
  return inflight
}

async function flush() {
  // ⚠️ 用 while 而不是一次 if：请求在途时页面又 ensure 了新类型，
  //    这一轮必须捎上，否则那批类型永远没人拉（loadedTypes 里没有、pending 里躺着）。
  while (pending.size) {
    const types = [...pending]
    pending.clear()
    try {
      const data = (await getDictDataBatch(types)) || {}
      for (const t of types) {
        const rows = data[t]
        if (Array.isArray(rows) && rows.length) {
          store[t] = rows.map((r) => ({
            label: r.label,
            value: cast(r.value, t),
            // 原始字符串码值留着：将来若有「按字符串比对」的场景不必再猜
            raw: r.value
          }))
        } else {
          // 请求成功但没有这一类的启用项 —— **这是权威答案，不是失败**：
          // 管理员可能把某一类全停用/删了。此时清空而不是回落到兜底种子，
          // 否则会把管理员刚删掉的选项「复活」，用户选中后提交一个库里已不存在的码值。
          // 打成 warn 是为了可发现：正常种子下这几类都该有值，空了大概率是数据问题。
          console.warn('[useDictOptions] 字典无启用项（按空处理）', t)
          store[t] = []
        }
        loadedTypes.add(t)
      }
    } catch (e) {
      // 刻意**不标 loadedTypes** → 下次进页面会重试。
      // 兜底种子保证这期间页面照常可用，不阻塞表单。
      console.error('[useDictOptions] 字典加载失败，沿用兜底种子', e)
    }
  }
  inflight = null
}

// ---------------------------------------------------------------------------
//  消费侧
// ---------------------------------------------------------------------------

/**
 * 下拉选项数组。
 *
 * ⚠️ 返回的是缓存里的**裸 reactive 数组**，不是 `computed` —— 这是刻意的：
 * `FormField.vue` 的 `resolve()` 是 `typeof v === 'function' ? v(model) : v`，
 * **不会解包 ref**。`options` 的函数若返回 computed，`v-for` 会去遍历一个 ref 对象，
 * 得到一个空白下拉。裸数组在模板里天然响应式（渲染时读了它，就被 render effect 追踪）。
 *
 * 可以安全地在模块级调用，比如 `form-config.js` 里：
 *   { prop: 'source', type: 'select', options: () => dictOptions('crm_source') }
 */
export const dictOptions = (type) => store[type] || []

/**
 * 码值 → 标签的映射，**必须在 setup 里调用**。
 *
 * ⚠️ 不要写成 `const M = Object.fromEntries(...)` 那样的模块级常量 ——
 * 那是一次性快照：首屏渲染时字典还没到，快照就定格在兜底种子上，之后永不更新。
 * 这正是「列表列全显示 `--`」的成因（只是以前种子内容恰好对，所以看不出来）。
 *
 * 模板里 `SOURCE_MAP[row.source]` 会自动解包 computed，用法不变。
 */
export function useDictMap(type) {
  return computed(() =>
    Object.fromEntries((store[type] || []).map((o) => [o.value, o.label]))
  )
}

/**
 * 单个码值取标签。
 *
 * 未命中返回**原值本身**（让脏码值在页面上看得见，而不是变成 `--` 把问题藏起来）；
 * 空值返回 `'--'`。顺带兼容了「老数据直接存了中文」的历史行 —— 那些值查不到，
 * 原样返回正好是想要的结果。
 */
export function dictLabel(type, value) {
  if (value === null || value === undefined || value === '') return '--'
  const hit = (store[type] || []).find(
    (o) => o.value === value || String(o.value) === String(value)
  )
  return hit ? hit.label : String(value)
}
