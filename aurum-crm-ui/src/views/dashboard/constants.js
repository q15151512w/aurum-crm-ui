// 本文件只放**静态展示配置**。原来这里 import 了 4 个字典常量做映射表 ——
// 那是一次性快照，会在首屏字典到达前就定格，正是「看板首屏全是 --」的成因。
// 现在改成下面的 FOCUS_MAP_TYPES（只描述"哪一列用哪张字典"），
// 真正的映射表由 index.vue 在 setup 里用 useDictMap 建 computed。

/**
 * 首页看板的展示配置
 *
 * 这里只放【怎么显示】（名称、图标、颜色、列定义），不放数据。
 * 数据一律来自 api/dashboard.js。
 *
 * META 里的 key 必须与《05-接口文档.md》第九节的响应字段名一致 ——
 * 视图就是靠这个 key 把接口数值映射成展示项的，对不上会显示成 `--`。
 */

/**
 * 「待办事项」区块 —— 对应文档 9.1 `/dashboard/todo`
 *
 * path 是点卡片跳转的目标路由。⚠️ 路径必须与 `src/mock/menu.js`（由后端 sys_menu 生成）
 * 里的实际路由一致，写错了守卫会把人送到 404。
 * 注意审核类页面的路径是连字符形式：`/crm/contract-audit`，**不是** `/crm/contract/audit`。
 */
export const TODO_META = [
  { key: 'pendingVisitCustomer', name: '待回访客户', icon: 'UserFilled', color: '#2C6DDB', path: '/crm/customer' },
  { key: 'pendingLead', name: '待处理线索', icon: 'Promotion', color: '#17B0C4', path: '/crm/lead' },
  { key: 'pendingOpportunity', name: '待处理商机', icon: 'TrendCharts', color: '#2C6DDB', path: '/crm/opportunity' },
  { key: 'pendingContractAudit', name: '待审核合同', icon: 'Document', color: '#F59A23', path: '/crm/contract-audit' },
  { key: 'pendingFinanceAudit', name: '待财务审核', icon: 'Money', color: '#2C6DDB', path: '/finance/payment-audit' },
  { key: 'pendingInvoice', name: '待财务开票', icon: 'Tickets', color: '#2C6DDB', path: '/finance/invoice-issue' }
]

/**
 * 「实时数据」区块 —— 对应文档 9.2 `/dashboard/stats`
 *
 * money=true 的按金额格式化（千分位 + 两位小数）；
 * 这三项对非财务角色会返回 null，组件里已做 `--` 兜底。
 */
export const REALTIME_META = [
  { key: 'leadCount', label: '新增线索(个)', money: false },
  { key: 'customerCount', label: '新增客户(个)', money: false },
  { key: 'opportunityCount', label: '新增商机(个)', money: false },
  { key: 'contractCount', label: '新增合同(个)', money: false },
  { key: 'salesAmount', label: '销售总额(元)', money: true },
  { key: 'receivedAmount', label: '已收款金额(元)', money: true },
  { key: 'invoicedAmount', label: '已开票金额(元)', money: true }
]

/** 实时数据的时间维度 —— 对应文档 9.2 的 range 参数 */
export const REALTIME_RANGES = [
  { label: '本月', value: 'month' },
  { label: '本周', value: 'week' },
  { label: '今日', value: 'day' }
]

/**
 * 「我关注的」单据类型页签 —— value 对应文档 9.3 的 tab 参数
 * path 同 TODO_META：点「查看全部」时跳到该单据的列表页
 */
export const FOCUS_TABS = [
  { label: '线索', value: 'lead', path: '/crm/lead' },
  { label: '客户', value: 'customer', path: '/crm/customer' },
  { label: '商机', value: 'opportunity', path: '/crm/opportunity' },
  { label: '商机报价单', value: 'quotation', path: '/crm/quotation' },
  { label: '合同', value: 'contract', path: '/crm/contract' },
  { label: '回款登记', value: 'payment', path: '/finance/payment' },
  { label: '发票登记', value: 'invoice', path: '/finance/invoice' }
]

/**
 * 「我关注的」表格列 —— 每个页签一套，与对应模块列表页的 `columns` 对齐。
 *
 * 后端 `/dashboard/focus` 是**按 tab 委托给各模块自己的分页查询**的，
 * 所以返回的就是那个模块的 `XxxRespVO`：码值、`id` / `name` 别名、`region` 派生字段
 * 都是现成的。这里的 prop 直接照抄各模块 `index.vue` 的 columns 即可。
 *
 * ⚠️ 两个坑：
 *   1. **字典字段是码值**，必须配 `map`（见下方 FOCUS_MAPS），
 *      否则表格里会显示 `3`、`5` 这样的数字；
 *   2. **状态机字段已经是中文标签**（商机 stage、报价单 status、合同 auditStatus），
 *      **不要**给它们配 map —— 后端转过了，再转一次会变成 `--`。
 */
export const FOCUS_COLUMNS = {
  lead: [
    // 一律用 minWidth 而不用 width：el-table 会把剩余宽度按比例分配，
    // 表格能自适应容器；写死 width 会超出看板左栏被裁掉。
    { prop: 'name', label: '线索名称', minWidth: 96 },
    { prop: 'source', label: '线索来源', minWidth: 84, map: 'SOURCE' },
    { prop: 'phone', label: '联系电话', minWidth: 104 },
    { prop: 'email', label: '联系邮箱', minWidth: 118 },
    { prop: 'industry', label: '客户行业', minWidth: 86, map: 'INDUSTRY' },
    { prop: 'ownerName', label: '负责人', minWidth: 74 },
    { prop: 'level', label: '客户级别', minWidth: 88, map: 'LEVEL' },
    { prop: 'nextContactTime', label: '下次联系时间', minWidth: 108 },
    { prop: 'region', label: '地区', minWidth: 108 },
    { prop: 'address', label: '详细地址', minWidth: 88 }
  ],

  customer: [
    { prop: 'name', label: '客户名称', minWidth: 96 },
    { prop: 'source', label: '客户来源', minWidth: 84, map: 'SOURCE' },
    { prop: 'phone', label: '联系电话', minWidth: 104 },
    { prop: 'email', label: '联系邮箱', minWidth: 118 },
    { prop: 'industry', label: '客户行业', minWidth: 86, map: 'INDUSTRY' },
    { prop: 'ownerName', label: '负责人', minWidth: 74 },
    { prop: 'level', label: '客户级别', minWidth: 88, map: 'LEVEL' },
    { prop: 'lastFollowTime', label: '最后跟进时间', minWidth: 118 },
    { prop: 'region', label: '地区', minWidth: 108 },
    { prop: 'dealStatus', label: '成交状态', minWidth: 88, map: 'DEAL_STATUS' }
  ],

  opportunity: [
    { prop: 'name', label: '商机名称', minWidth: 110 },
    { prop: 'customerName', label: '客户名称', minWidth: 110 },
    { prop: 'ownerName', label: '负责人', minWidth: 74 },
    { prop: 'stage', label: '商机阶段', minWidth: 88 },
    { prop: 'expectDealTime', label: '预计成交时间', minWidth: 118 },
    { prop: 'nextContactTime', label: '下次联系时间', minWidth: 118 },
    { prop: 'totalAmount', label: '合计总价', minWidth: 100, money: true },
    { prop: 'finalAmount', label: '整单最终价', minWidth: 100, money: true }
  ],

  quotation: [
    { prop: 'name', label: '报价单名称', minWidth: 110 },
    { prop: 'quotationNo', label: '报价单编号', minWidth: 118 },
    { prop: 'opportunityName', label: '商机名称', minWidth: 110 },
    { prop: 'customerName', label: '客户名称', minWidth: 110 },
    { prop: 'ownerName', label: '负责人', minWidth: 74 },
    { prop: 'quoteDate', label: '报价日期', minWidth: 100 },
    { prop: 'totalAmount', label: '合计总价', minWidth: 100, money: true },
    { prop: 'finalAmount', label: '整单最终价', minWidth: 100, money: true }
  ],

  contract: [
    { prop: 'name', label: '合同名称', minWidth: 110 },
    { prop: 'contractNo', label: '合同编号', minWidth: 118 },
    { prop: 'customerName', label: '客户名称', minWidth: 110 },
    { prop: 'opportunityName', label: '商机名称', minWidth: 110 },
    { prop: 'signDate', label: '签约日期', minWidth: 100 },
    { prop: 'ownerName', label: '负责人', minWidth: 74 },
    { prop: 'auditStatus', label: '合同状态', minWidth: 88 },
    { prop: 'finalAmount', label: '整单最终价', minWidth: 100, money: true }
  ]

  // ⚠️ 没有 payment / invoice 两套列定义，是**故意的**：
  //    后端的 /dashboard/focus 对这两个 tab 返回空页（财务模块尚未实现，
  //    没有可委托的 Service，见 DashboardServiceImpl 的注释）。
  //    给它们编一套列只会让人以为这个页签能用。视图层对没有列定义的 tab
  //    传 `[]`，表格直接显示「暂无数据」—— 比套用线索的列（列名全对不上）诚实。
}

/**
 * 「我关注的」表格里的码值 → 中文映射。
 *
 * ⚠️ 这些字段是**数据字典字段**，后端返回的是 TINYINT 码值
 * （见《05-接口文档》的字段口径约定），列表页靠 `#cell-xxx` slot 映射，
 * 看板这里靠列配置上的 `map` 键指向一组映射表。
 *
 * 注意：**状态机字段**（商机的 stage、报价单的 status、合同的 auditStatus）
 * 不在这里 —— 后端已经把码值转成中文标签返回了，前端不需要也不该再映射一次。
 *
 * ⚠️ 这里**只放"哪一列用哪张字典"的类型表**，不放映射表本身：
 *    映射表要随字典接口的返回变化，必须由 `index.vue` 在 setup 里用 `useDictMap`
 *    建成 `computed`。写成模块级的常量对象会是一次性快照 —— 首屏字典还没到就定格，
 *    之后永不更新，表现就是「看板里的来源/行业/级别全是 --」。
 */
export const FOCUS_MAP_TYPES = {
  SOURCE: 'crm_source',
  INDUSTRY: 'crm_industry',
  LEVEL: 'crm_customer_level',
  DEAL_STATUS: 'crm_deal_status'
}

/**
 * AI 小助手的快捷入口。
 *
 * 与其它入口一样带真实 `path`，点击就是普通跳转（跳到 AI 整页）。
 *
 * 由前端**合成**进 shortcuts，而不是让后端 `/dashboard/shortcuts` 返回：
 * 那个接口的契约是「数据库里配的路由清单」，而 AI 整页是前端静态注册的路由、
 * 不来自 `sys_menu`，塞进去会污染语义。
 *
 * 放在本文件还顺带白捡一道校验：`check:static` 的「看板图标名都存在」只扫这里，
 * 图标名写错会当场报出来。
 */
export const AI_ENTRY = {
  name: 'AI小助手',
  path: '/ai/chat',
  icon: 'MagicStick',
  color: '#7C4DFF'
}
