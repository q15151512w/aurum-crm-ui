/**
 * 本地 mock 数据库
 *
 * ⚠️ 后端除了 /health 之外一个接口都没实现，所以每个页面都得靠 mock 才能渲染。
 *    与其给 20 多个页面各写一份假数据，不如在这里按「资源」统一造，
 *    api 层按文档的分页约定（pageNo/pageSize → list/total）统一查询。
 *
 * 数据样式取自原型页面的示例行（人名、金额、状态都是原型上的原值），
 * 数量扩到 30 条左右，好让分页有东西可翻。
 *
 * 后端就绪后整个 src/mock 目录都可以删掉。
 */

// 树是按 id 找节点的逻辑，组件里也要用，放 utils 里共用一份
// （这里用相对路径而不是 @ 别名，好让这个文件能脱离 vite 直接用 node 跑测试）
import { findTreeNode } from '../utils/tree.js'

export { findTreeNode }

// ---------------------------------------------------------------------------
// 造数据用的小工具
// ---------------------------------------------------------------------------
const NAMES = ['王林', '李侯', '刘婷', '李明', '吴红', '赵磊', '孙倩', '周杰', '郑爽', '冯超',
  '陈静', '褚岩', '卫东', '蒋雯', '沈括', '韩梅', '杨林', '朱迪', '秦岚', '许诺',
  '何强', '吕鑫', '施雨', '张涛', '孔明', '曹阳', '严松', '华筝', '金鑫', '魏来']
const COMPANIES = ['华阳科技', '恒信商贸', '中远物流', '天成建材', '瑞达电子', '鑫源食品', '博远医疗', '嘉禾农业',
  '宏图机械', '云海网络', '锦程纺织', '安泰化工']
const OWNERS = ['李传锋', '杨林', '傅彭薄', '王五', '王乐康', '张三', '王漫']
// ⚠️ 下面三组是**字典码值字段**，必须存数字码值、不能存中文 ——
//    后端 LeadRespVO/CustomerRespVO 的 source/industry/level 是 Integer，前端下拉的
//    option.value 也来自字典（数字）。存中文的话列表能靠 map 的「未命中返回原值」
//    侥幸显示出中文，但**编辑回显会空白**（select 找不到匹配项），且不报任何错。
//    取值见 sql/crm.sql 的 sys_dict_data。
const SOURCES = [1, 2, 3, 4, 5, 6, 7]        // crm_source         1官网…7其他
const INDUSTRIES = [1, 2, 3, 4, 5, 6, 7, 8]  // crm_industry       1制造业…8其他
const LEVELS = [1, 2, 3]                     // crm_customer_level 1重要 2普通 3非优先
const REGIONS = ['广东省广州市天河区', '浙江省宁波市鄞州区', '浙江省宁波市奉化区', '江苏省苏州市工业园区', '山东省潍坊市寒亭区']
// （原先这里有个 PAY_METHODS = ['支付宝','银行转账','微信']，全文件无人引用，且与
//   fin_payment_method 字典完全不符 —— 回款行本来就直接生成码值 (i%5)+1。已删除。）
// 发票类型是**字典码值字段**（不是状态机中文枚举）：后端 InvoiceRespVO.invoiceType 是
// Integer，取值 1~4，标签见 FinanceDictLabels 与 sys_dict_data.fin_invoice_type。
// ⚠️ 这里曾经存中文（'增值税专用发票' 等），与下拉选项（value 为 1~4）对不上 ——
//    列表能靠 invoiceTypeLabel 的「中文直通」分支显示，但**编辑回显会空白**
//    （select 的 value 找不到匹配项）。种子必须与后端同口径。
const INVOICE_TYPES = [1, 2, 3, 4]

/** 稳定伪随机：同样的索引永远得到同样的值，避免每次刷新数据都在变 */
const pick = (arr, i) => arr[i % arr.length]
const money = (i, base = 5000) => base + (i % 17) * 1370
const date = (i, y = 2025) => {
  const m = String(((i % 12) + 1)).padStart(2, '0')
  const d = String(((i % 27) + 1)).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const dateTime = (i) => `${date(i)} ${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`

/**
 * 相对今天的日期
 *
 * 「下次联系时间」这类字段必须相对当天生成 —— 写死某个年份的话，
 * 过一阵子全部会变成「已逾期」标红，看不出哪条是真该提醒的。
 */
const relDate = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 生成 n 行，fn(i) 造第 i 行 */
const gen = (n, fn) => Array.from({ length: n }, (_, i) => ({ id: i + 1, ...fn(i) }))

// ---------------------------------------------------------------------------
// 各资源的数据
// ---------------------------------------------------------------------------

/** 线索 / 客户 共用一套字段（原型上两页的列几乎一样） */
const partyFields = (i) => ({
  name: pick(NAMES, i),
  source: pick(SOURCES, i),
  phone: `138****${String(8880 + i).slice(-4)}`,
  email: `138888${i}@${pick(['qq.com', '126.com', '163.com', 'foxmail.com'], i)}`,
  industry: pick(INDUSTRIES, i),
  ownerName: pick(OWNERS, i),
  level: pick(LEVELS, i),
  // 有过去也有将来：过去的需要提醒、将来的正常
  nextContactTime: relDate((i % 21) - 7),
  region: pick(REGIONS, i),
  address: 'xx路1号',
  remark: i % 3 === 0 ? '--' : '客户主动咨询，意向较强',
  creator: pick(NAMES, i + 5),
  createTime: dateTime(i + 10)
})

export const lead = gen(30, (i) => ({ ...partyFields(i), starred: i % 4 === 0 }))

/** 线索池：比线索多了放入原因/人/时间 */
export const leadPool = gen(18, (i) => ({
  ...partyFields(i + 2),
  poolReason: pick(['长期未跟进', '负责人离职', '区域调整', '客户主动放弃'], i),
  poolRemark: i % 2 ? '待重新分配' : '--',
  poolUserName: pick(OWNERS, i),
  poolTime: dateTime(i + 20)
}))

export const customer = gen(30, (i) => ({
  ...partyFields(i + 1),
  dealStatus: i % 3 === 0 ? 1 : 2, // crm_deal_status 1未成交 2已成交
  starred: i % 5 === 0
}))

export const customerPool = gen(18, (i) => ({
  ...partyFields(i + 3),
  poolReason: pick(['超过回收天数未跟进', '客户明确拒绝', '负责人离职'], i),
  poolRemark: i % 2 ? '可再开发' : '--',
  poolUserName: pick(OWNERS, i),
  poolTime: dateTime(i + 25)
}))

/**
 * 客户联系人，按 customerId 分组
 *
 * ⚠️ 早先这里是一份**不分客户的共享数组**，于是每个客户详情页看到的联系人都一样，
 *    增删改也全串在一起。真实表 crm_contact 有 customer_id 外键，mock 用一个
 *    map 表达同样的事。
 *
 * 字段口径与其它表一致用展示名：name / title / primary（不是 contact_name / position / is_primary）。
 */
const CONTACT_TITLES = ['采购经理', '技术总监', '财务主管', '行政专员', '总经理']

export const contactsByCustomer = {}
for (let cid = 1; cid <= customer.length; cid++) {
  // 每个客户 1~3 个联系人，第一个是主联系人
  const count = (cid % 3) + 1
  contactsByCustomer[cid] = Array.from({ length: count }, (_, i) => ({
    id: cid * 100 + i + 1,
    customerId: cid,
    name: pick(NAMES, cid + i),
    title: pick(CONTACT_TITLES, cid + i),
    phone: `138****${String(8880 + cid + i).slice(-4)}`,
    telephone: `021-${String(60000000 + cid * 100 + i).slice(-8)}`,
    email: `contact${cid}${i}@aurum.com`,
    wechat: i % 2 ? `wx_${cid}${i}` : '--',
    gender: i % 2 ? '女' : '男',
    primary: i === 0,
    remark: '--'
  }))
}

// ---------------------------------------------------------------------------
// 归属流转记录（crm_owner_change_log）
// ---------------------------------------------------------------------------
/**
 * 字段按《02-建表文档》第四节第 6 项：biz_type(1线索 2客户) / biz_id / biz_name /
 * action / from_owner / to_owner / reason_remark / operator / create_time。
 *
 * ⚠️ 这是**活数据**，不是在页面里写死一份假时间线：
 *    客户详情的「操作记录」Tab 读它，而放入公海 / 分配 / 领取 / 线索转化这些动作
 *    都会往这里追加一条。否则那一页永远显示同一批假记录，看着像没接上。
 */
export const ownerChangeLog = []

/** 动作码 → 展示文案（建表文档里 action 是 1~6 的编码） */
export const OWNER_CHANGE_ACTION = {
  1: '分配',
  2: '领取',
  3: '放入公海',
  4: '规则自动回收',
  5: '管理员改派',
  6: '线索转化'
}

/** 业务类型：建表文档写的是 1线索 2客户 */
export const BIZ_TYPE = { lead: 1, customer: 2 }

/**
 * 追加一条归属流转记录
 * @param {Object} entry { bizType, bizId, bizName, action, fromOwnerName, toOwnerName, reasonRemark, operatorName }
 */
export function pushOwnerChangeLog(entry) {
  ownerChangeLog.unshift({
    logId: ownerChangeLog.length + 1,
    fromOwnerName: '',
    toOwnerName: '',
    reasonRemark: '--',
    operatorName: MOCK_CURRENT_USER,
    createTime: nowStr(),
    ...entry
  })
}

/** 按业务查流转记录（新的在前） */
export function findOwnerChangeLog(bizType, bizId) {
  return ownerChangeLog.filter(
    (r) => String(r.bizType) === String(bizType) && String(r.bizId) === String(bizId)
  )
}

// ---------------------------------------------------------------------------
// 客户开票信息（crm_customer_invoice_info）
// ---------------------------------------------------------------------------
/**
 * 按 customerId 分组
 *
 * ⚠️ 同联系人：早先整个项目共用一份开票信息数组，于是每个客户看到的抬头都一样，
 *    增删改也全串在一起。真实表有 customer_id 外键。
 *
 * 字段口径与其它表一致用展示名：title / taxNo / bankName / bankAccount / address / phone / isDefault
 * （对应建表文档的 invoice_title / tax_no / bank_name / bank_account / invoice_addr / invoice_phone / is_default）。
 */
export const invoiceInfoByCustomer = {}
for (let cid = 1; cid <= customer.length; cid++) {
  // 每个客户 1~2 条，第一条是默认
  const count = (cid % 2) + 1
  invoiceInfoByCustomer[cid] = Array.from({ length: count }, (_, i) => ({
    id: cid * 100 + i + 1,
    customerId: cid,
    title: `${pick(COMPANIES, cid)}有限公司`,
    taxNo: `9131000${String(cid).padStart(2, '0')}MA1FL0${String(i + 1).padStart(1, '0')}XXX`,
    bankName: pick(['中国银行上海分行', '工商银行北京分行', '建设银行广州分行'], cid + i),
    bankAccount: `4553 0000 ${String(1234 + cid).padStart(4, '0')} ${String(5678 + i).padStart(4, '0')}`,
    address: '上海市浦东新区xx路1号',
    phone: `021-${String(88888800 + cid).slice(-8)}`,
    isDefault: i === 0
  }))
}

/** 拍平，用于跨客户按 id 查（开票信息的 id 在一张表里全局唯一） */
export function allInvoiceInfo() {
  return Object.values(invoiceInfoByCustomer).flat()
}

/** 按 id 找开票信息，连同它所属客户的数组一起返回（增删改要操作那个数组） */
export function findInvoiceInfoWithList(id) {
  for (const list of Object.values(invoiceInfoByCustomer)) {
    const info = findById(list, id)
    if (info) return { info, list }
  }
  return null
}

/** 所有联系人拍平，用于跨客户按 id 查（联系人的 id 在一张表里是全局唯一的） */
export function allContacts() {
  return Object.values(contactsByCustomer).flat()
}

/**
 * 按 id 找联系人，**连同它所在的那个数组一起返回**
 *
 * 增删改必须操作它所属的那个客户下的数组，光有行对象不够
 * （removeById 只认数组）。找不到返回 null。
 */
export function findContactWithList(id) {
  for (const list of Object.values(contactsByCustomer)) {
    const contact = findById(list, id)
    if (contact) return { contact, list }
  }
  return null
}

export const opportunity = gen(24, (i) => ({
  name: `${pick(NAMES, i)}的商机`,
  customerName: pick(COMPANIES, i),
  ownerName: pick(OWNERS, i),
  expectDealTime: date(i + 8),
  nextContactTime: date(i + 2),
  productKinds: 1 + (i % 4),
  productCount: 2 + (i % 6),
  totalAmount: money(i, 4000),
  discount: (i % 4) * 5,
  finalAmount: money(i, 4000) * (1 - ((i % 4) * 5) / 100),
  stage: pick(['初步接洽', '需求确认', '方案报价', '商务谈判'], i),
  creator: pick(NAMES, i + 7),
  createTime: dateTime(i + 12),
  starred: i % 6 === 0
}))

export const quotation = gen(20, (i) => ({
  name: `${pick(COMPANIES, i)}报价单`,
  quotationNo: `BJ${20250000 + i}`,
  opportunityName: `${pick(NAMES, i)}的商机`,
  quoteDate: date(i + 5),
  customerName: pick(COMPANIES, i),
  ownerName: pick(OWNERS, i),
  status: pick(['报价中', '已生成合同', '已失效'], i),
  productCount: 2 + (i % 5),
  totalAmount: money(i, 3500),
  discount: (i % 3) * 5,
  finalAmount: money(i, 3500) * (1 - ((i % 3) * 5) / 100),
  profit: money(i, 900),
  remark: i % 2 ? '--' : '含税报价，有效期 30 天',
  creator: pick(NAMES, i + 3),
  createTime: dateTime(i + 14),
  starred: i % 5 === 0
}))

const CONTRACT_STATUS = ['未提交', '审核中', '审核通过', '审核拒绝']

export const contract = gen(26, (i) => ({
  name: `${pick(COMPANIES, i)}采购合同`,
  contractNo: `HT${20250000 + i}`,
  customerName: pick(COMPANIES, i),
  opportunityName: `${pick(NAMES, i)}的商机`,
  quotationNo: `BJ${20250000 + i}`,
  signDate: date(i + 1),
  ownerName: pick(OWNERS, i),
  startDate: date(i + 1),
  endDate: date(i + 1, 2026),
  auditStatus: pick(CONTRACT_STATUS, i),
  contractType: (i % 3) + 1, // crm_contract_type 1销售 2框架 3补充协议（字典码值，不是中文）
  customerSigner: pick(NAMES, i + 2),
  companySigner: pick(OWNERS, i),
  finalAmount: money(i, 8000),
  profit: money(i, 1800),
  remark: i % 2 ? '--' : '含税，按季度付款',
  creator: pick(NAMES, i + 4),
  createTime: dateTime(i + 16),
  starred: i % 7 === 0
}))

/** 合同审核：待审核列表，列与合同略有不同（多了提交人/提交时间，少了状态） */
export const contractAudit = gen(14, (i) => {
  const c = contract[i]
  return {
    contractId: c.id,
    name: c.name,
    contractNo: c.contractNo,
    customerName: c.customerName,
    opportunityName: c.opportunityName,
    quotationNo: c.quotationNo,
    signDate: c.signDate,
    ownerName: c.ownerName,
    startDate: c.startDate,
    endDate: c.endDate,
    customerSigner: c.customerSigner,
    companySigner: c.companySigner,
    finalAmount: c.finalAmount,
    profit: c.profit,
    // 审批进度相关字段：真实后端由 /crm/contract/audit-list 每行回填（《05-接口文档》第六节）
    // ⚠️ 提交人不是创建人：creator 是建单人，applyUserName 是点「提交审核」的人
    applyUserName: c.creator,
    applyTime: dateTime(i + 18),
    currentNodeName: '部门主管审批',
    pendingApproverNames: ['王总监'],
    nextNodeName: '财务审批',
    nextApproverNames: ['赵财务', '陈会计']
  }
})

export const productCategory = gen(12, (i) => ({
  name: pick(['手机数码', '电脑办公', '家用电器', '食品饮料', '母婴用品', '医药保健', '服装鞋帽', '家居家装', '运动户外', '图书文娱', '汽车用品', '宠物用品'], i),
  code: `LX${String(i + 1).padStart(3, '0')}`,
  remark: i % 3 === 0 ? '--' : '常规分类',
  creator: pick(NAMES, i),
  createTime: dateTime(i + 6)
}))

export const product = gen(26, (i) => ({
  name: pick(['手机', '电脑', '鼠标', '奶粉', 'sweetis钙片', '显示器', '键盘', '耳机', '打印机', '路由器',
    '保温杯', '洗发水', '牙膏', '大米', '食用油', '纸巾', '书包', '台灯', '电风扇', '充电宝',
    '数据线', '移动硬盘', '摄像头', '音箱', '扫地机', '加湿器'], i),
  code: `CP${String(i + 1).padStart(4, '0')}`,
  categoryName: productCategory[i % productCategory.length].name,
  unitName: pick(['台', '个', '箱', '件', '瓶'], i),
  // 成本价对非授权角色会被后端置 null，这里留几条演示兜底展示
  costPrice: i % 8 === 7 ? null : money(i, 100),
  salePrice: money(i, 300),
  // 税率：与 crm.sql 的种子（软件 6%、硬件 13%）同一口径，这里按 13/6/9/3 轮换，
  // 让「选产品自动带出税率」在 mock 模式下也能看出差别（原先产品种子没有这个字段）
  taxRate: pick([13, 6, 9, 3], i),
  onShelf: i % 3 !== 0,
  description: '常规商品',
  imageUrl: '',
  creator: pick(NAMES, i + 1),
  createTime: dateTime(i + 8)
}))

const AUDIT_STATUS = ['未提交', '审核中', '审核通过', '审核拒绝']

/**
 * 回款状态码
 *
 * ⚠️ 真实后端 {@code fin_payment} 有 audit_status（审核）与 status（收款确认）两列，
 *    发票「可开票回款」的口径是 **auditStatus=2 且 status=1**（见
 *    InvoiceServiceImpl.PAYMENT_AUDIT_PASSED / PAYMENT_CONFIRMED）。
 *    mock 里只保留了 auditStatus 的中文标签，这里补一个与之一致的 status，
 *    否则页面按 status 过滤时会把所有回款都筛掉。
 */
const PAYMENT_CONFIRMED = { 财务审核通过: 1 }

/**
 * 回款
 *
 * ⚠️ customerId / contractId / contractName 三个字段是**发票页面新增的需求**：
 *    原先只有 customerName，而「选客户后带出该客户的可开票回款」必须按
 *    customerId 过滤（queryPage 对未知 key 做精确匹配，有键就能筛）。
 *    customerName 由 customerId 推导，保证两者永远一致 —— 分开 pick 会造出
 *    「客户A的名字配客户B的id」这种脏数据，且只在发票页才暴露。
 */
export const payment = gen(26, (i) => {
  const cid = (i % customer.length) + 1
  const contractId = (i % contract.length) + 1
  const auditStatus = pick(['未提交', '财务审核中', '财务审核拒绝', '财务审核通过'], i)
  return {
    paymentNo: `HK${20250000 + i}`,
    customerId: cid,
    customerName: customer[cid - 1].name,
    contractId,
    contractNo: contract[contractId - 1].contractNo,
    contractName: contract[contractId - 1].name,
    ownerName: pick(OWNERS, i),
    amount: money(i, 6000),
    unpaidAmount: money(i, 2000),
    paymentDate: date(i + 4),
    paymentMethod: (i % 5) + 1,
    auditStatus,
    // 收款确认：审核通过的那些才算已确认
    status: PAYMENT_CONFIRMED[auditStatus] ?? 0,
    invoiceStatus: pick(['已开票', '未开票', '--'], i),
    remark: i % 2 ? '--' : '分期回款',
    creator: pick(NAMES, i + 6),
    createTime: dateTime(i + 11),
    starred: i % 4 === 0
  }
})

/** 财务审核：待审核的回款，列更少 */
export const paymentAudit = gen(12, (i) => {
  const p = payment[i]
  return {
    paymentId: p.id, paymentNo: p.paymentNo, customerName: p.customerName,
    amount: p.amount, unpaidAmount: p.unpaidAmount, paymentDate: p.paymentDate,
    paymentMethod: p.paymentMethod, remark: p.remark, creator: p.creator, createTime: p.createTime
  }
})

/**
 * 发票回款明细（fin_invoice_payment）—— 一票多回款的**唯一事实来源**
 *
 * 先于 invoice 构造：每张发票的明细要先定下来，发票的价税合计才能由明细汇总出来
 * （口径与后端一致：总额 = Σ 本次开票金额，再按税率拆不含税与税额）。
 * 详情 / 编辑表单读的就是这张表，`fin_invoice.payment_id` 只是「主回款」。
 */
export const invoicePayment = []

/**
 * 发票
 *
 * ⚠️ 与后端同口径：`amount/taxAmount/totalAmount` 都是**由明细算出来的**，不独立编造。
 *    早先这里每个金额各 pick 一次，于是「本次开票金额」与行的合计对不上 ——
 *    服务端会重算并覆盖，前端显示的数在保存后凭空变了，看着像丢数据。
 *
 * customerId 与六个开票信息字段是**快照 / 引用**两种不同语义，别混：
 *   · customerId → 引用，客户改名后发票跟着显示新名字（customerName 由它推导）
 *   · invoiceTitle 等六个 → 快照，落库即与客户档案解耦，客户日后改抬头不影响历史发票
 */
export const invoice = gen(24, (i) => {
  const cid = (i % customer.length) + 1
  const info = invoiceInfoByCustomer[cid]?.find((r) => r.isDefault) || null
  const applyAmount = money(i, 3000)
  const taxRate = 13
  // 含税总额 → 不含税 → 税额取残差，保证 total = amount + taxAmount 精确成立
  const amount = Number((applyAmount / (1 + taxRate / 100)).toFixed(2))
  return {
    applyNo: `KP${20250000 + i}`,
    invoiceNo: i % 3 === 0 ? `045${12340 + i}` : null,
    customerId: cid,
    customerName: customer[cid - 1].name,
    amount,
    taxRate,
    taxAmount: Number((applyAmount - amount).toFixed(2)),
    totalAmount: applyAmount,
    applyDate: date(i + 6),
    issueDate: i % 3 === 0 ? date(i + 9) : null,
    invoiceType: pick(INVOICE_TYPES, i),
    // 发票信息快照：客户没有开票信息时全空（原型「支持调整」的前置条件）
    invoiceTitle: info?.title || '',
    taxNo: info?.taxNo || '',
    bankName: info?.bankName || '',
    bankAccount: info?.bankAccount || '',
    invoiceAddr: info?.address || '',
    invoicePhone: info?.phone || '',
    ownerName: pick(OWNERS, i),
    status: pick(['未提交', '开票中', '已开票', '财务拒绝'], i),
    remark: i % 2 ? '--' : '需寄送纸质件',
    creator: pick(NAMES, i + 8),
    createTime: dateTime(i + 13),
    starred: i % 6 === 0
  }
})

/**
 * 给发票铺明细行
 *
 * 每张票 1~2 笔回款，金额**恰好等于该发票的价税合计**（与后端「总额 = Σ 明细」一致）。
 * 从该客户名下、已审核通过且已确认的回款里挑，挑不到才退化成按金额造一行 ——
 * 种子里有客户根本没有合格回款，硬凑会让「剩余可开额」出现负数。
 */
invoice.forEach((inv, i) => {
  const candidates = payment.filter(
    (p) => p.customerId === inv.customerId && p.status === 1 && p.amount > 0
  )
  const first = candidates[0]
  const second = candidates[1]
  if (first && second && i % 2 === 0 && inv.totalAmount > second.amount) {
    const head = Number((inv.totalAmount - second.amount).toFixed(2))
    invoicePayment.push({ id: invoicePayment.length + 1, invoiceId: inv.id, paymentId: first.id, writeOffAmount: head })
    invoicePayment.push({ id: invoicePayment.length + 1, invoiceId: inv.id, paymentId: second.id, writeOffAmount: Number(second.amount.toFixed(2)) })
    return
  }
  const target = first || payment[i % payment.length]
  invoicePayment.push({ id: invoicePayment.length + 1, invoiceId: inv.id, paymentId: target.id, writeOffAmount: inv.totalAmount })
})

/** 财务开票：待开票列表 */
export const invoiceIssue = gen(12, (i) => {
  const v = invoice[i]
  return {
    invoiceId: v.id, applyNo: v.applyNo, customerName: v.customerName,
    amount: v.amount, applyDate: v.applyDate, invoiceType: v.invoiceType,
    ownerName: v.ownerName, remark: v.remark, creator: v.creator, createTime: v.createTime
  }
})

// ---------------------------------------------------------------------------
// 系统设置
// ---------------------------------------------------------------------------

/** 部门树（组织架构页） */
export const deptTree = [
  {
    id: 1, name: '零捌集团', leaderName: '超级管理员', type: 'group',
    children: [
      { id: 2, name: '采购部', leaderName: '王林', type: 'dept', children: [
        { id: 20, name: '采购一组', leaderName: '李侯', type: 'team', children: [] },
        { id: 21, name: '采购二组', leaderName: '刘婷', type: 'team', children: [] }
      ] },
      { id: 3, name: '财务部', leaderName: '李明', type: 'dept', children: [] },
      { id: 4, name: '质量部', leaderName: '吴红', type: 'dept', children: [] },
      { id: 5, name: '仓运部', leaderName: '赵磊', type: 'dept', children: [] },
      { id: 6, name: '销售部', leaderName: '杨林', type: 'dept', children: [
        { id: 60, name: '销售一组', leaderName: '孙倩', type: 'team', children: [] },
        { id: 61, name: '销售二组', leaderName: '周杰', type: 'team', children: [] },
        { id: 62, name: '销售三组', leaderName: '郑爽', type: 'team', children: [] }
      ] },
      { id: 7, name: '生产部', leaderName: '冯超', type: 'dept', children: [] }
    ]
  }
]

/** 在职状态 / 账号状态，对应 PUT /system/user/{id}/status 的三态 */
const WORK_STATUS = ['在职', '在职', '在职', '离职']
const ACCOUNT_STATUS = ['已激活', '已激活', '已禁用']

export const user = gen(28, (i) => ({
  name: pick(NAMES, i),
  username: `user${String(i + 1).padStart(3, '0')}`,
  gender: i % 2 ? '女' : '男',
  phone: `138****${String(8880 + i).slice(-4)}`,
  email: `user${i + 1}@aurum.com`,
  birthday: date(i + 2, 1990 + (i % 12)),
  deptId: [2, 3, 4, 5, 6, 7][i % 6],
  deptName: ['采购部', '财务部', '质量部', '仓运部', '销售部', '生产部'][i % 6],
  // 直属上级（建表文档 sys_user.superior_id）。留几个空的好看出「未设置」的展示
  superiorName: i % 5 === 4 ? '' : pick(NAMES, i + 11),
  roleName: pick(['超级管理员', '销售主管', '销售专员', '财务'], i),
  workStatus: pick(WORK_STATUS, i),
  accountStatus: pick(ACCOUNT_STATUS, i)
}))

export const role = gen(4, (i) => ({
  name: ['超级管理员', '销售主管', '销售专员', '财务'][i],
  roleKey: ['admin', 'sales_director', 'sales', 'finance'][i],
  dataScope: ['全部数据', '本部门及以下', '仅本人', '全部数据'][i],
  userCount: [1, 3, 18, 4][i],
  remark: ['系统内置', '销售团队管理', '一线销售', '财务核算'][i],
  createTime: dateTime(i + 1)
}))

/**
 * 角色 ↔ 人员关联（对应 sys_user_role 关联表）
 *
 * 没有这份映射的话，「选择角色人员」和「移除」改完，角色人员列表还是原来那一批，
 * 看着像没生效。这里先给 4 个内置角色预置几段分配。
 */
export const roleUserIds = {
  1: [1],
  2: [2, 3, 4],
  3: [5, 6, 7, 8, 9, 10, 11, 12],
  4: [13, 14]
}

export const roleGroup = gen(3, (i) => ({
  name: `组组合${['一', '二', '三'][i]}`,
  roleCount: 2 + i,
  remark: '--',
  createTime: dateTime(i + 2)
}))

export const loginLog = gen(30, (i) => ({
  userName: pick(NAMES, i),
  username: `user${String((i % 20) + 1).padStart(3, '0')}`,
  phone: `138****${String(8880 + i).slice(-4)}`,
  loginTime: dateTime(i),
  ip: `192.168.${i % 5}.${(i * 13) % 255}`,
  browser: pick(['Chrome 120', 'Edge 120', 'Firefox 121', 'Safari 17'], i),
  os: pick(['Windows 11', 'macOS 14', 'Ubuntu 22.04'], i),
  duration: ((i * 7) % 12) + 1
}))

export const operationLog = gen(24, (i) => ({
  userName: pick(NAMES, i),
  module: pick(['线索', '客户', '商机', '合同', '回款', '发票', '系统'], i),
  action: pick(['新增', '修改', '删除', '导出', '审核'], i),
  method: 'com.aurum.crm.controller.XxxController.xxx()',
  params: '{"id":1}',
  ip: `192.168.${i % 5}.${(i * 11) % 255}`,
  costMs: 20 + ((i * 13) % 300),
  status: i % 9 === 8 ? '失败' : '成功',
  operateTime: dateTime(i)
}))

function mockNumberingItems(prefix, length) {
  return [
    { id: `mock-${prefix}-prefix`, type: 'FIXED_PREFIX', value: prefix, length: null, sort: 0, sequenceBasis: false },
    { id: `mock-${prefix}-year`, type: 'YEAR', value: null, length: null, sort: 1, sequenceBasis: false },
    { id: `mock-${prefix}-month`, type: 'MONTH', value: null, length: null, sort: 2, sequenceBasis: false },
    { id: `mock-${prefix}-day`, type: 'DAY', value: null, length: null, sort: 3, sequenceBasis: true },
    { id: `mock-${prefix}-serial`, type: 'SERIAL', value: null, length, sort: 4, sequenceBasis: true }
  ]
}

export const numberingRule = gen(7, (i) => {
  const code = ['LEAD', 'CUSTOMER', 'OPP', 'QUOTE', 'CONTRACT', 'PAYMENT', 'INVOICE'][i]
  const prefix = ['XS', 'KH', 'SJ', 'BJ', 'HT', 'HK', 'FP'][i]
  const seqLength = i >= 4 ? 6 : 4
  return {
    name: ['线索编号', '客户编号', '商机编号', '报价单编号', '合同编号', '回款编号', '发票申请编号'][i],
    code, prefix, dateFormat: 'yyyyMMdd', seqLength, resetCycle: '按日', enabled: true,
    example: `${prefix}20260914000${i + 1}`, items: mockNumberingItems(prefix, seqLength)
  }
})

export const unit = gen(8, (i) => ({
  name: ['台', '个', '箱', '件', '瓶', '套', '米', '千克'][i],
  remark: i % 3 === 0 ? '--' : '常规单位',
  creator: pick(NAMES, i),
  createTime: dateTime(i + 3)
}))

/**
 * 字典类型
 *
 * ⚠️ 这里的 `type` 编码**必须与 sql/crm.sql 的 `sys_dict_type` 种子逐字一致**
 *    （`crm_source` 而不是 `customer_source`）。前端 `composables/useDictOptions.js`
 *    是按编码去 `GET /system/dict-data/batch?types=...` 取数的 —— 编码对不上就是
 *    「下拉全空」，而且不报任何错，看起来像接口没实现。
 *
 * 前 6 项曾经用的是另一套旧编码（customer_source / payment_method / invoice_type…），
 * 内容也与字典不符（回款方式写的是「支付宝/微信」），已按真实种子重做。
 */
const DICT_TYPE_SEED = [
  ['客户来源', 'crm_source'],
  ['所属行业', 'crm_industry'],
  ['客户级别', 'crm_customer_level'],
  ['成交状态', 'crm_deal_status'],
  ['公海原因', 'crm_pool_reason'],
  ['商机阶段', 'crm_opp_stage'],
  ['合同类型', 'crm_contract_type'],
  ['发票类型', 'fin_invoice_type'],
  ['回款方式', 'fin_payment_method'],
  ['附件类型', 'crm_attachment_type'],
  ['数据范围', 'sys_data_scope']
]

export const dictType = gen(DICT_TYPE_SEED.length, (i) => ({
  name: DICT_TYPE_SEED[i][0],
  type: DICT_TYPE_SEED[i][1],
  status: '正常',
  remark: '--',
  createTime: dateTime(i + 4)
}))

/**
 * 字典项（字典类型下的一行）
 *
 * ⚠️ `type` 必须与上面 `dictType` 的 `type` **一一对应** —— 字典管理页是主从结构，
 *    左边选中一个类型、右边按 `type` 过滤它的项。对不上就是「选中了、右边永远空」，
 *    而且不会报错，看起来像过滤逻辑写错了。
 *
 * 状态用中文（与真实后端一致：状态机字段后端转中文标签返回）。
 */
const dictItem = (type, pairs) =>
  pairs.map(([label, value], i) => ({
    type,
    label,
    value,
    sort: i + 1,
    status: '正常',
    isDefault: false,
    remark: '--',
    createTime: dateTime(i + 5)
  }))

/**
 * 字典项
 *
 * ⚠️ 内容与 `sql/crm.sql` 的 `sys_dict_data` 种子逐字对齐。`value` 一律是**字符串**
 *    （后端 `DictDataRespVO.value` 就是 String），由 `useDictOptions` 按类型归一化成数字。
 *    种子若写成数字，mock 下就看不出归一化这段逻辑有没有生效 —— 所以这里保持字符串。
 */
export const dictData = [
  ...dictItem('crm_source', [
    ['官网', '1'], ['电话', '2'], ['展会', '3'], ['转介绍', '4'], ['广告', '5'], ['地推', '6'], ['其他', '7']
  ]),
  ...dictItem('crm_industry', [
    ['制造业', '1'], ['互联网', '2'], ['金融', '3'], ['教育', '4'], ['医疗', '5'], ['政府', '6'], ['零售', '7'], ['其他', '8']
  ]),
  ...dictItem('crm_customer_level', [['重要', '1'], ['普通', '2'], ['非优先', '3']]),
  ...dictItem('crm_deal_status', [['未成交', '1'], ['已成交', '2']]),
  // 公海原因共 5 项 —— 客户池和线索池原先各自内联了一份手写 map，
  // 一份把 2/3/4 写成「业务调整/离职转交/其他」，另一份缺第 5 项，两份都错。
  ...dictItem('crm_pool_reason', [
    ['长期未跟进', '1'], ['主动放弃', '2'], ['管理员操作', '3'], ['规则自动回收', '4'], ['客户失联', '5']
  ]),
  ...dictItem('crm_opp_stage', [
    ['初步接洽', '1'], ['需求确认', '2'], ['方案报价', '3'], ['商务谈判', '4'], ['赢单', '5'], ['输单', '6']
  ]),
  ...dictItem('crm_contract_type', [['销售合同', '1'], ['框架合同', '2'], ['补充协议', '3']]),
  ...dictItem('fin_invoice_type', [
    ['增值税专票', '1'], ['增值税普票', '2'], ['电子专票', '3'], ['电子普票', '4']
  ]),
  ...dictItem('fin_payment_method', [
    ['银行转账', '1'], ['现金', '2'], ['支票', '3'], ['在线支付', '4'], ['其他', '5']
  ]),
  ...dictItem('crm_attachment_type', [
    ['合同扫描件', '1'], ['发票PDF', '2'], ['营业执照', '3'], ['其他', '4']
  ]),
  ...dictItem('sys_data_scope', [
    ['全部数据', '1'], ['自定义数据', '2'], ['本部门数据', '3'], ['本部门及以下数据', '4'], ['仅本人数据', '5']
  ])
].map((row, i) => ({ id: i + 1, ...row }))

export const poolRule = gen(2, (i) => ({
  poolType: ['线索池', '公海'][i],
  name: `${['线索池', '公海'][i]}回收规则`,
  recycleDays: [30, 60][i],
  claimLimit: [10, 20][i],
  claimCycle: '每月',
  notifyDays: [3, 7][i],
  enabled: true
}))

// ---------------------------------------------------------------------------
// 统一分页查询
// ---------------------------------------------------------------------------

/**
 * 筛选胶囊的语义映射
 *
 * 原型上那排「全部X / 我负责的X / 我关注的X / 未提交 / 审核中 …」不是数据库字段，
 * 而是**取数口径**（数据范围 + 状态分组）。行里没有 scope 这个字段，
 * 所以不能当等值过滤 —— 早先按等值处理，导致点任何一个胶囊都是空表。
 *
 * ⚠️ 真实环境这些条件由后端的 DataScope（见接口文档 1.6）+ 状态码处理，
 *    前端传参只作提示。这里只是让 mock 下的交互看起来是真的。
 */
export const MOCK_CURRENT_USER = '李传锋'

/**
 * 有效发票明细（fin_invoice_payment ⋈ fin_invoice，排除已作废）
 *
 * 「某笔回款已被开票多少」的**唯一口径**，发票表单算「可开余额」就查它。
 * 作废发票（status=2）的明细保留在表里作审计轨迹，但**不计入占用** ——
 * 所以这里过滤掉，作废后额度自动释放（与后端
 * {@code InvoicePaymentMapper#sumAllocatedByPaymentIds} 的 `i.status != 2` 一致）。
 *
 * @param {number|string} [excludeInvoiceId] 编辑态传本发票 id，用于把本票自己的占用
 *        排除掉：被本票占满的回款在编辑时仍应显示为可选，否则用户一打开编辑就少了几行。
 */
export function activeAllocations(excludeInvoiceId) {
  const voided = new Set(invoice.filter((v) => v.status === '已作废').map((v) => String(v.id)))
  return invoicePayment.filter((ip) => {
    if (voided.has(String(ip.invoiceId))) return false
    if (excludeInvoiceId != null && String(ip.invoiceId) === String(excludeInvoiceId)) return false
    return true
  })
}

/** 某笔回款已被（有效发票）占用的开票金额 */
export function allocatedOfPayment(paymentId, excludeInvoiceId) {
  return round2(
    activeAllocations(excludeInvoiceId)
      .filter((ip) => String(ip.paymentId) === String(paymentId))
      .reduce((sum, ip) => sum + Number(ip.writeOffAmount || 0), 0)
  )
}

/** 两位小数，避免金额相减后出现 0.30000000000000004 这类浮点噪声 */
function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

const IN_AUDIT = ['审核中', '财务审核中', '开票中']
const APPROVED = ['审核通过', '财务审核通过']
const REJECTED = ['审核拒绝', '财务审核拒绝', '财务拒绝']

const SCOPE_PREDICATES = {
  // —— 数据范围 ——
  mine: (r) => r.ownerName === MOCK_CURRENT_USER,
  subordinate: (r) => r.ownerName !== MOCK_CURRENT_USER,
  starred: (r) => !!r.starred,

  // —— 客户 ——（dealStatus 是字典码值：1未成交 2已成交）
  dealt: (r) => r.dealStatus === 2,
  undealt: (r) => r.dealStatus === 1,

  // —— 单据状态（合同/回款/发票共用一套） ——
  draft: (r) => r.auditStatus === '未提交',
  auditing: (r) => IN_AUDIT.includes(r.auditStatus),
  approved: (r) => APPROVED.includes(r.auditStatus),
  rejected: (r) => REJECTED.includes(r.auditStatus),

  // —— 报价单 ——
  quoting: (r) => r.status === '报价中',
  contracted: (r) => r.status === '已生成合同',
  expired: (r) => r.status === '已失效',

  // —— 回款的开票状态 ——
  invoiced: (r) => r.invoiceStatus === '已开票',
  notInvoiced: (r) => r.invoiceStatus === '未开票',

  // —— 发票 ——
  issuing: (r) => r.status === '开票中',
  issued: (r) => r.status === '已开票',

  // —— 产品上下架 ——
  onShelf: (r) => r.onShelf === true,
  offShelf: (r) => r.onShelf === false,

  // —— 人员 ——
  active: (r) => r.accountStatus === '已激活',
  disabled: (r) => r.accountStatus === '已禁用',
  resigned: (r) => r.workStatus === '离职'
}

/** 分页 + 关键字 + 筛选 */
export function queryPage(rows, params = {}) {
  const { pageNo = 1, pageSize = 20, keyword = '', ...rest } = params

  let list = rows

  if (keyword) {
    const kw = String(keyword).toLowerCase()
    list = list.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(kw))
    )
  }

  for (const [k, v] of Object.entries(rest)) {
    if (v === '' || v == null || v === 'all') continue

    // scope 走语义映射
    if (k === 'scope') {
      const predicate = SCOPE_PREDICATES[v]
      // 未登记的取值不要静默筛空，留着更容易发现漏配
      if (predicate) list = list.filter(predicate)
      continue
    }

    list = list.filter((r) => String(r[k]) === String(v))
  }

  const total = list.length
  const start = (pageNo - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, pageNo, pageSize }
}

/** 按 id 找一行 */
export function findById(rows, id) {
  return rows.find((r) => String(r.id) === String(id)) || null
}

/**
 * 从数组里真的删掉若干行
 *
 * 之前各页的删除操作在 mock 下只是 delay 后返回 null，数据没动，
 * 于是「删除成功」的提示之后一刷新那行又回来了 —— 看着像 bug。
 * 这里就地改数组（数组是模块级导出的引用，各页面共用的就是同一份）。
 */
export function removeById(rows, id) {
  const i = rows.findIndex((r) => String(r.id) === String(id))
  if (i > -1) rows.splice(i, 1)
  return null
}

/** 批量删除 */
export function removeByIds(rows, ids = []) {
  const set = new Set(ids.map(String))
  for (let i = rows.length - 1; i >= 0; i--) {
    if (set.has(String(rows[i].id))) rows.splice(i, 1)
  }
  return null
}

// ---------------------------------------------------------------------------
// 写入（新增 / 修改）
// ---------------------------------------------------------------------------
/**
 * 为什么要有这一节
 *
 * 早先各 api 的 create/update 在 mock 下只是 `return { ...data, id: Date.now() }`，
 * **根本没往数组里写**。于是「保存成功」的提示之后，列表里既没多出新行、
 * 改了字段的也纹丝不动 —— 表单接上去就是一堆假成功。
 *
 * 这里提供就地写库的工具。数组是模块级导出的引用，各页面共用的就是同一份，
 * 改了立刻对所有人可见。
 */

/** 当前时间 'YYYY-MM-DD HH:mm' */
export function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 今天 'YYYY-MM-DD' */
export function todayStr() {
  return nowStr().slice(0, 10)
}

/** 自增 id：取现有最大值 +1，避免与 gen() 造的 1..N 和 Date.now() 撞车 */
export function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1
}

/**
 * 新增一行
 *
 * ⚠️ 用 unshift 插到**头部**，不是 push 到末尾 —— queryPage 按数组顺序分页，
 *    追加到末尾的话新行会落在最后一页，用户点完「保存」在当前页看不到任何变化。
 *
 * creator / createTime 由这里补，因为列表页大多有这两列，缺了就是一片「--」。
 */
export function insertRow(rows, data = {}) {
  const row = {
    creator: MOCK_CURRENT_USER,
    createTime: nowStr(),
    ...data,
    id: nextId(rows)
  }
  rows.unshift(row)
  return row
}

/** 修改一行（就地合并，保留原 id） */
export function updateById(rows, id, data = {}) {
  const row = findById(rows, id)
  if (!row) return null
  Object.assign(row, data, { id: row.id })
  return row
}

// ---------------------------------------------------------------------------
// 树形写入（部门、产品分类）
// ---------------------------------------------------------------------------
// ⚠️ removeById 只扫顶层，拿它删树里的子节点会静默失败（删部门页就踩过）。
//    树相关的增删改一律用这里的函数。

/** 树里现有 id 的最大值 +1 */
export function nextTreeId(tree) {
  let max = 0
  const walk = (nodes) => {
    for (const node of nodes) {
      max = Math.max(max, Number(node.id) || 0)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return max + 1
}

/** 在 parentId 下新增节点；parentId 为 0/null 时挂到根 */
export function insertTreeNode(tree, data = {}, parentId = 0) {
  const node = { children: [], ...data, id: nextTreeId(tree) }

  if (parentId === 0 || parentId === '0' || parentId == null) {
    tree.push(node)
    return node
  }

  const parent = findTreeNode(tree, parentId)
  if (!parent) return null
  if (!parent.children) parent.children = []
  parent.children.push(node)
  return node
}

export function updateTreeNode(tree, id, data = {}) {
  const node = findTreeNode(tree, id)
  if (!node) return null
  Object.assign(node, data, { id: node.id })
  return node
}

/** 删除节点（连同其子树） */
export function removeTreeNode(tree, id) {
  const idx = tree.findIndex((n) => String(n.id) === String(id))
  if (idx > -1) {
    tree.splice(idx, 1)
    return null
  }
  for (const node of tree) {
    if (node.children?.length) removeTreeNode(node.children, id)
  }
  return null
}

// ---------------------------------------------------------------------------
// 归属流转记录的预置数据
// ---------------------------------------------------------------------------
// ⚠️ 必须放在文件**末尾**：pushOwnerChangeLog 里会用到 MOCK_CURRENT_USER 和 nowStr，
//    那两个 const/function 声明在文件靠后的位置，在上面调用会撞上 TDZ
//    （Cannot access 'MOCK_CURRENT_USER' before initialization）。
for (const c of customer) {
  pushOwnerChangeLog({
    bizType: BIZ_TYPE.customer,
    bizId: c.id,
    bizName: c.name,
    action: OWNER_CHANGE_ACTION[1],
    fromOwnerName: pick(OWNERS, c.id + 1),
    toOwnerName: c.ownerName,
    reasonRemark: '区域调整',
    operatorName: '超级管理员',
    createTime: dateTime(c.id + 2)
  })
  if (c.id % 3 === 0) {
    pushOwnerChangeLog({
      bizType: BIZ_TYPE.customer,
      bizId: c.id,
      bizName: c.name,
      action: OWNER_CHANGE_ACTION[3],
      fromOwnerName: c.ownerName,
      toOwnerName: '',
      reasonRemark: '超过回收天数未跟进',
      operatorName: '超级管理员',
      createTime: dateTime(c.id + 5)
    })
  }
}
// 预置的 createTime 是递增的，统一按时间倒序（新的在前）
ownerChangeLog.sort((a, b) => (a.createTime < b.createTime ? 1 : -1))
