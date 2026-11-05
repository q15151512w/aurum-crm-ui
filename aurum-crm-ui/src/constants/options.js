/**
 * 下拉选项集
 *
 * ⚠️ 本文件有**两种定位完全不同的常量**，别混用
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  一、「数据字典兜底种子」（下文标了「字典种子」的那些）
 * ─────────────────────────────────────────────────────────────────────────
 * 值**存在 `sys_dict_data` 表里**，真正的数据源是 `GET /system/dict-data/batch`。
 * 这里的副本只是 `composables/useDictOptions.js` 的**缓存初值 / 接口挂掉时的兜底**。
 *
 *   1. **只有 `composables/useDictOptions.js` 允许 import 它们。**
 *      页面、组件、`form-config.js` 一律通过 `dictOptions()` / `useDictMap()` /
 *      `dictLabel()` 取数。反面例子：在页面里直接
 *      `import { CUSTOMER_SOURCE_OPTIONS }`，那个下拉就永远停在种子值上 ——
 *      管理员在「字典管理」页改了字典，页面纹丝不动，且不报任何错。
 *      —— 这条有 `scripts/check-static.mjs` 的规则兜着，不是只靠自觉。
 *   2. 种子内容以 `sql/crm.sql` 的 `sys_dict_data` 为准：接口拿不到数据时
 *      它就是线上的样子，**不能随手改**。
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  二、「状态机枚举选项」（`opts([...])` 生成的）
 * ─────────────────────────────────────────────────────────────────────────
 * 值**写死在 Java 枚举 / DDL 注释里**，后端负责把码值转成中文标签再返回。
 * 这些页面照常直接 import，不经过字典接口。
 *
 * ⚠️ 两套口径并存，别用错（详见《开发注意事项》第 9 条）
 *
 *   1. **码值口径**（`*_CODE_OPTIONS`，value 是 TINYINT）：用于**数据字典字段**，
 *      如 source / industry / level / dealStatus / contractType。
 *      后端收发的就是码值，中文标签由页面的 `#cell-xxx` slot 映射出来。
 *      —— 客户、线索、合同走这套。
 *   2. **中文口径**（`opts([...])`，value 就是中文）：用于**状态机枚举字段**，
 *      如商机 stage / 报价单 status / 合同审核态。后端负责把码值转成中文标签再返回。
 *      —— 商机、报价单走这套。
 *
 * 判断标准：这个字段的值存在 `sys_dict_data` 里，还是写死在 Java 枚举里。
 */

/** 文本即值：label 与 value 相同，是**状态机枚举**字段的口径（见文件头说明 2） */
const opts = (values) => values.map((v) => ({ label: v, value: v }))

// ===========================================================================
//  字典种子（8 类）—— 只给 composables/useDictOptions.js 用，页面别直接 import
//
//  以上 8 类的 `value` 全是**数字码值**（后端 DTO 是 Integer）。
//  useDictOptions 会把接口返回的字符串码值（`"1"`）归一化成数字，
//  所以这里的种子也必须写成数字，否则「接口到达前 / 到达后」元素类型不一致。
// ===========================================================================

/** 字典种子 crm_source —— 客户/线索来源 */
export const CUSTOMER_SOURCE_OPTIONS = [
  { label: '官网', value: 1 },
  { label: '电话', value: 2 },
  { label: '展会', value: 3 },
  { label: '转介绍', value: 4 },
  { label: '广告', value: 5 },
  { label: '地推', value: 6 },
  { label: '其他', value: 7 }
]

/** 字典种子 crm_industry —— 所属行业 */
export const CUSTOMER_INDUSTRY_OPTIONS = [
  { label: '制造业', value: 1 },
  { label: '互联网', value: 2 },
  { label: '金融', value: 3 },
  { label: '教育', value: 4 },
  { label: '医疗', value: 5 },
  { label: '政府', value: 6 },
  { label: '零售', value: 7 },
  { label: '其他', value: 8 }
]

/** 字典种子 crm_customer_level —— 客户级别（1重要 2普通 3非优先） */
export const CUSTOMER_LEVEL_CODE_OPTIONS = [
  { label: '重要', value: 1 },
  { label: '普通', value: 2 },
  { label: '非优先', value: 3 }
]

/** 字典种子 crm_deal_status —— 成交状态（1未成交 2已成交） */
export const DEAL_STATUS_CODE_OPTIONS = [
  { label: '未成交', value: 1 },
  { label: '已成交', value: 2 }
]

/** 字典种子 crm_contract_type —— 合同类型 */
export const CONTRACT_TYPE_CODE_OPTIONS = [
  { label: '销售合同', value: 1 },
  { label: '框架合同', value: 2 },
  { label: '补充协议', value: 3 }
]

/** 字典种子 fin_invoice_type —— 发票类型 */
export const INVOICE_TYPE_OPTIONS = [
  { label: '增值税专票', value: 1 },
  { label: '增值税普票', value: 2 },
  { label: '电子专票', value: 3 },
  { label: '电子普票', value: 4 }
]

/**
 * 字典种子 fin_payment_method —— 回款方式
 *
 * ⚠️ 曾经这里是 `PAY_METHOD_OPTIONS = opts(['支付宝','银行转账','微信'])`（中文值），
 * 与字典**完全不符**，且 `PaymentSaveReqVO.paymentMethod` 是 Integer ——
 * 谁用了那份常量，一选「支付宝」提交就必挂。已删除。
 */
export const PAYMENT_METHOD_CODE_OPTIONS = [
  { label: '银行转账', value: 1 },
  { label: '现金', value: 2 },
  { label: '支票', value: 3 },
  { label: '在线支付', value: 4 },
  { label: '其他', value: 5 }
]

/**
 * 字典种子 crm_pool_reason —— 进入公海/线索池的原因（共 5 项）
 *
 * ⚠️ 曾经客户池和线索池各自内联了一份手写 map，内容**互相矛盾**
 * （客户池把 2/3/4 写成「业务调整/离职转交/其他」，线索池缺第 5 项）。
 * 两份都已删除，统一走字典。
 */
export const POOL_REASON_CODE_OPTIONS = [
  { label: '长期未跟进', value: 1 },
  { label: '主动放弃', value: 2 },
  { label: '管理员操作', value: 3 },
  { label: '规则自动回收', value: 4 },
  { label: '客户失联', value: 5 }
]

// ===========================================================================
//  状态机枚举选项（值写死在 Java 枚举 / DDL 里，页面直接 import）
// ===========================================================================

// ---------------------------------------------------------------------------
//  商机 / 报价单
// ---------------------------------------------------------------------------

/**
 * 商机阶段（《建表文档》3.3：1初步接洽 → 6输单）
 *
 * ⚠️ **本项不接字典，是刻意的。** `sys_dict_data` 里确实有一条 `crm_opp_stage`
 * 且值同为 1~6，但后端 `OpportunityStage` 是 Java 枚举、走「后端转中文」口径，
 * 前端全程用中文当值（见 `opportunity/detail.vue` 的阶段变更下拉用 `!==` 比较）。
 * 把它切到字典口径是**破坏性接口变更**，要同时改后端枚举和商机模块所有页面。
 * 动之前先和后端对齐，别只改前端。
 */
export const OPPORTUNITY_STAGE_OPTIONS = opts([
  '初步接洽',
  '需求确认',
  '方案报价',
  '商务谈判',
  '赢单',
  '输单'
])

/** 报价单状态（《建表文档》3.4：0草稿 1已发出 2已接受 3已拒绝 4已作废） */
export const QUOTATION_STATUS_OPTIONS = opts(['报价中', '已生成合同', '已失效'])

// ---------------------------------------------------------------------------
//  合同 / 财务
// ---------------------------------------------------------------------------
export const CONTRACT_STATUS_OPTIONS = opts(['未提交', '审核中', '审核通过', '审核拒绝'])

export const PAYMENT_STATUS_OPTIONS = opts([
  '未提交',
  '财务审核中',
  '财务审核拒绝',
  '财务审核通过'
])

/** 回款的开票状态 */
export const INVOICE_STATUS_OPTIONS = opts(['未开票', '已开票'])

export const INVOICE_APPLY_STATUS_OPTIONS = opts(['未提交', '开票中', '已开票', '财务拒绝'])

// ---------------------------------------------------------------------------
//  产品
// ---------------------------------------------------------------------------
// 单位下拉不再用硬编码常量：改为读 GET /system/unit/simple-list
// （见 composables/useUnitOptions.js）。原来的 UNIT_NAME_OPTIONS 已删除 ——
// 它和 sys_unit 的种子数据不一致，导致「下拉里选了单位、保存却报 2408」。

// ---------------------------------------------------------------------------
//  系统设置
// ---------------------------------------------------------------------------
/**
 * 部门类型
 *
 * 原型把组织架构画成三级：集团 → 部门 → 小组，三种节点三种底色（见组织架构页的图例）。
 * 取值是 mock/db.js 里 deptTree 节点用的 type 字段。
 */
export const DEPT_TYPE_OPTIONS = [
  { label: '集团', value: 'group' },
  { label: '行政部门', value: 'dept' },
  { label: '部门小组', value: 'team' }
]

/** 性别（《建表文档》5.2：0未知 1男 2女） */
export const GENDER_OPTIONS = opts(['男', '女'])

/** 人员在职状态（对应「激活 / 禁用 / 操作离职」三态，见 api/system.js 的 changeUserStatus） */
export const WORK_STATUS_OPTIONS = opts(['在职', '离职'])

export const ACCOUNT_STATUS_OPTIONS = opts(['已激活', '已禁用'])

/**
 * 角色数据范围（《建表文档》5.3）—— 选「自定义」时才显示部门树
 *
 * ⚠️ **本项不接字典，是刻意的。** `sys_dict_data` 里有 `sys_data_scope`，
 * 但它的 value 是码值 1~5 而标签也不同（字典写「自定义数据」，这里写「自定义」），
 * 后端的 `RoleSaveReqVO.dataScope` 收的是**这里的中文**。
 * 切到字典口径要同步改 `RoleSaveReqVO` / `RoleConvert` 和角色页所有联动判断
 * （含下面那个 `DATA_SCOPE_CUSTOM`），动之前先和后端对齐。
 */
export const DATA_SCOPE_OPTIONS = opts([
  '全部数据',
  '自定义',
  '本部门',
  '本部门及以下',
  '仅本人'
])

/** 数据范围选「自定义」的取值，供表单联动判断 */
export const DATA_SCOPE_CUSTOM = '自定义'

/** 编号规则的重置周期（《建表文档》5.4：0不重置 1按日 2按月 3按年） */
export const RESET_CYCLE_OPTIONS = opts(['不重置', '按日', '按月', '按年'])

/** 规则编码，对应后端的编号规则引擎 */
export const RULE_CODE_OPTIONS = [
  { label: '线索编号', value: 'LEAD' },
  { label: '客户编号', value: 'CUSTOMER' },
  { label: '商机编号', value: 'OPP' },
  { label: '报价单编号', value: 'QUOTE' },
  { label: '合同编号', value: 'CONTRACT' },
  { label: '回款编号', value: 'PAYMENT' },
  { label: '发票申请编号', value: 'INVOICE' }
]

// ---------------------------------------------------------------------------
//  公海 / 线索池
// ---------------------------------------------------------------------------
/** 池类型（《建表文档》2.2：1线索池 2客户池） */
export const POOL_TYPE_OPTIONS = opts(['线索池', '公海'])

export const CLAIM_CYCLE_OPTIONS = opts(['按日', '按周', '按月'])

/** 日期格式段，编号规则用 */
export const DATE_FORMAT_OPTIONS = opts(['yyyyMMdd', 'yyyyMM', 'yyyy', ''])
