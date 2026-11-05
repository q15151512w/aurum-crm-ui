/**
 * api 层直测 —— 验证「mock 下写操作真的改了数据」
 *
 * 为什么需要它：
 *   `src/api/*.js` 用的是 `@` 别名 + `import.meta.env`，node 直接 import 不了，
 *   所以以前只能测到 `src/mock/db.js` 这一层。而真正的坑恰恰在 api 层 ——
 *   比如 `createXxx` 只 `return { ...data }` 不写数组、`leadToPool` 用了没 import 的
 *   `nextId`（ReferenceError）。这些 **build 全都不报错**，只有真的调一次才发现。
 *
 * 做法：把 api 源码里的别名与 env 替换掉，写进系统临时目录再 import，
 * 就能在 node 里直接调用真实的 api 函数。**不往项目里落任何文件。**
 *
 * 用法：
 *   npm run check:mock
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src', 'api')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aurum-api-test-'))
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }))

// --- 1. 准备可被 node 加载的副本 ---
fs.writeFileSync(
  path.join(TMP, '_mock.mjs'),
  `export const USE_MOCK = true
export const delay = () => Promise.resolve()
export function mockNotImplemented(name) { return Promise.reject(new Error('MOCK 未实现: ' + name)) }
`
)

fs.writeFileSync(
  path.join(TMP, 'request-stub.mjs'),
  `export default function request() { throw new Error('不该走到真实请求分支！') }\n`
)

// mock 下的文件在项目里、副本在临时目录，所以要用 file:// 绝对路径
const toUrl = (p) => 'file:///' + path.join(ROOT, p).replace(/\\/g, '/')
const dbUrl = toUrl('src/mock/db.js')
const menuUrl = toUrl('src/mock/menu.js')
// ⚠️ `api/customer.js`（以及后来的 `api/lead.js`）会 import `@/constants/regions` 来拆省市区，
//    这个别名原先没进下面的替换表，导致副本里留下裸 `@/constants` —— node 解析不了，
//    整个 check:mock 直接以 ERR_MODULE_NOT_FOUND 挂掉（不是断言失败，是加载失败）。
//    regions.js 自身没有任何 import，所以只需指向原文件即可，不用复制。
const regionsUrl = toUrl('src/constants/regions.js')

const copies = {}
for (const file of fs.readdirSync(SRC)) {
  if (!file.endsWith('.js') || file === '_mock.js') continue
  const out = file.replace('.js', '.mjs')
  let src = fs.readFileSync(path.join(SRC, file), 'utf8')
  src = src
    .replace(/from '\.\/_mock'/g, "from './_mock.mjs'")
    .replace(/from '@\/api\/_mock'/g, "from './_mock.mjs'")
    .replace(/from '@\/utils\/request'/g, "from './request-stub.mjs'")
    .replace(/from '@\/mock\/db'/g, `from '${dbUrl}'`)
    .replace(/from '@\/mock\/menu'/g, `from '${menuUrl}'`)
    .replace(/from '@\/constants\/regions'/g, `from '${regionsUrl}'`)
  fs.writeFileSync(path.join(TMP, out), src)
  copies[file] = out
}

// --- 2. 断言工具 ---
let pass = 0
const fails = []
function ok(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fails.push(label); console.log(`  ✗ ${label} ${extra}`) }
}
function section(t) { console.log(`\n=== ${t} ===`) }

// --- 3. 导入被测模块 ---
// 副本在临时目录，必须用 file:// 绝对路径（相对路径会按脚本所在目录解析）
const imp = (srcName) =>
  import('file:///' + path.join(TMP, copies[srcName]).replace(/\\/g, '/'))

const db = await import(dbUrl)
const authApi = await imp('auth.js')
const leadApi = await imp('lead.js')
const custApi = await imp('customer.js')
const sysApi = await imp('system.js')
const finApi = await imp('finance.js')
const oppApi = await imp('opportunity.js')

// ---------------------------------------------------------------------------
section('线索转客户 —— 主线上最关键的一步')
{
  const before = db.customer.length
  const lead = db.lead[0]
  const created = await leadApi.convertLead(lead.id, {})

  ok('真的建出了客户记录', created && created.name === lead.name, `created=${JSON.stringify(created)?.slice(0, 60)}`)
  ok('客户表 +1', db.customer.length === before + 1)
  ok('新客户出现在列表最前面', db.customer[0].id === created.id)
  ok('线索上记下了 convertedCustomerId', db.findById(db.lead, lead.id).convertedCustomerId === created.id)
  ok('新客户默认未成交', created.dealStatus === '未成交')
}

// ---------------------------------------------------------------------------
section('放入公海 → 分配 / 领取')
{
  const target = db.customer[5]
  const poolCountBefore = db.customerPool.length
  await custApi.customerToPool(target.id, { reason: '测试放入' })

  ok('客户负责人被清空（公海的定义）', db.findById(db.customer, target.id).ownerName === '')
  ok('公海 +1', db.customerPool.length === poolCountBefore + 1)

  // 池行有自己的主键，靠 customerId 指回客户
  const pooled = db.customerPool.find((r) => r.customerId === target.id)
  ok('公海行存在且带 customerId', !!pooled, `customerId=${target.id}`)
  ok('记录下了放入原因', pooled?.poolReason === '测试放入')
  ok('池行 id 不与客户 id 混淆', pooled && String(pooled.id) !== String(target.id))
  ok('公海里没有重复 id', new Set(db.customerPool.map((r) => r.id)).size === db.customerPool.length)

  // 分配给别人
  await custApi.assignCustomerFromPool(pooled.id, { ownerUserId: 3, ownerName: '李侯' })
  ok('分配后负责人写回了客户表', db.findById(db.customer, target.id).ownerName === '李侯')
  ok('分配后从公海列表摘掉', db.customerPool.length === poolCountBefore)

  // 再放回去，走领取
  await custApi.customerToPool(target.id, { reason: '再测一次' })
  const pooled2 = db.customerPool.find((r) => r.customerId === target.id)
  await custApi.claimCustomerFromPool(pooled2.id)
  ok('领取后负责人是当前用户', db.findById(db.customer, target.id).ownerName === db.MOCK_CURRENT_USER)
  ok('领取后从公海列表摘掉', db.customerPool.length === poolCountBefore)
}

// ---------------------------------------------------------------------------
section('线索池分配 / 领取')
{
  const target = db.lead[7]
  const poolCountBefore = db.leadPool.length
  await leadApi.leadToPool(target.id, { reason: '测试' })

  ok('线索负责人被清空', db.findById(db.lead, target.id).ownerName === '')
  ok('线索池 +1', db.leadPool.length === poolCountBefore + 1)

  const pooled = db.leadPool.find((r) => r.leadId === target.id)
  ok('池行带 leadId 指回线索', !!pooled)
  ok('线索池里没有重复 id', new Set(db.leadPool.map((r) => r.id)).size === db.leadPool.length)

  await leadApi.assignLeadFromPool(pooled.id, { ownerUserId: 2, ownerName: '王林' })
  ok('分配后负责人写回', db.findById(db.lead, target.id).ownerName === '王林')
  ok('分配后从线索池摘掉', db.leadPool.length === poolCountBefore)

  await leadApi.leadToPool(target.id, { reason: '再测' })
  const pooled2 = db.leadPool.find((r) => r.leadId === target.id)
  await leadApi.claimLeadFromPool(pooled2.id)
  ok('领取后负责人是当前用户', db.findById(db.lead, target.id).ownerName === db.MOCK_CURRENT_USER)
  ok('领取后从线索池摘掉', db.leadPool.length === poolCountBefore)
}

// ---------------------------------------------------------------------------
section('自助注册 → 禁用 → 分配角色 → 激活（有账号必有角色）')
{
  const n = db.user.length
  await authApi.register({
    username: 'zhangsan_test',
    phone: '13800001111',
    smsCode: '123456',
    password: 'abc12345'
  })

  const created = db.user.find((u) => u.username === 'zhangsan_test')
  ok('注册真的写进了 user 表', db.user.length === n + 1 && !!created)
  ok('初始状态是「已禁用」', created?.accountStatus === '已禁用')
  ok('初始没有任何角色', created?.roleName === '')

  // 未分配角色就激活 → 必须被拒
  let rejected = false
  try {
    await sysApi.changeUserStatus(created.id, 1)
  } catch {
    rejected = true
  }
  ok('未分配角色时激活被拒绝', rejected)
  ok('被拒后状态没变', db.findById(db.user, created.id).accountStatus === '已禁用')

  // 分配角色后再激活 → 通过
  await sysApi.updateUser(created.id, { roleName: '销售专员' })
  await sysApi.changeUserStatus(created.id, 1)
  ok('分配角色后可以激活', db.findById(db.user, created.id).accountStatus === '已激活')
}

// ---------------------------------------------------------------------------
section('人员三态变更')
{
  const u = db.user[0]
  await sysApi.changeUserStatus(u.id, 2)
  ok('禁用 → accountStatus', db.findById(db.user, u.id).accountStatus === '已禁用')
  await sysApi.changeUserStatus(u.id, 3)
  ok('离职 → workStatus', db.findById(db.user, u.id).workStatus === '离职')
  await sysApi.changeUserStatus(u.id, 1)
  ok('激活 → 两个状态都复位',
    db.findById(db.user, u.id).accountStatus === '已激活' &&
    db.findById(db.user, u.id).workStatus === '在职')
}

// ---------------------------------------------------------------------------
section('增删改是否真的落库（列表页闭环）')
{
  const n = db.lead.length
  const created = await leadApi.createLead({ name: '直测线索', source: '广告' })
  ok('createLead 落到数组头部', db.lead[0].id === created.id && db.lead.length === n + 1)
  await leadApi.updateLead(created.id, { name: '改名了' })
  ok('updateLead 真的改了', db.findById(db.lead, created.id).name === '改名了')
  await leadApi.deleteLead(created.id)
  ok('deleteLead 真的删了', db.lead.length === n)
}

// ---------------------------------------------------------------------------
section('联系人（按客户分组）')
{
  const cid = 3
  const n = db.contactsByCustomer[cid].length
  const created = await custApi.createContact({ customerId: cid, name: '直测联系人', primary: true })
  ok('新增到该客户名下', db.contactsByCustomer[cid].length === n + 1)
  ok('设为主联系人会取消旧的', db.contactsByCustomer[cid].filter((c) => c.primary).length === 1)
  const otherBefore = db.contactsByCustomer[4].length
  ok('不影响其它客户', otherBefore > 0 && db.contactsByCustomer[4].every((c) => c.name !== '直测联系人'))
  await custApi.deleteContact(created.id)
  ok('删除只影响本客户', db.contactsByCustomer[cid].length === n)
}

// ---------------------------------------------------------------------------
section('商机阶段变更 + 添加产品')
{
  const o = db.opportunity[0]
  const logBefore = (await oppApi.getOpportunityStageLog(o.id)).length
  await oppApi.changeOpportunityStage(o.id, { stage: '商务谈判', remark: '直测' })
  ok('阶段真的改了', db.findById(db.opportunity, o.id).stage === '商务谈判')
  const logs = await oppApi.getOpportunityStageLog(o.id)
  ok('阶段历史 +1', logs.length === logBefore + 1)
  ok('历史里记的是变更前后', logs[0].toStage === '商务谈判' && !!logs[0].fromStage)
  ok('操作人是当前用户', logs[0].operator === db.MOCK_CURRENT_USER)

  const detail = await oppApi.getOpportunityDetail(o.id)
  const pn = detail.products.length
  await oppApi.addOpportunityProducts(o.id, [
    { productId: 99, productName: '直测产品', unitName: '台', quantity: 1, unitPrice: 100, discountRate: 0, taxRate: 13, amount: 100 }
  ])
  const after = await oppApi.getOpportunityDetail(o.id)
  ok('产品明细 +1', after.products.length === pn + 1)
  ok('加的产品确实在里面', after.products.some((p) => p.productName === '直测产品'))

  // 整份覆盖（详情页的「产品明细」弹窗走这条）
  await oppApi.updateOpportunityProducts(o.id, [
    { productId: 1, productName: '只剩一行', unitName: '个', quantity: 2, unitPrice: 50, discountRate: 0, taxRate: 0, amount: 100 }
  ])
  const replaced = await oppApi.getOpportunityDetail(o.id)
  ok('整份覆盖后只剩一行', replaced.products.length === 1)
  ok('覆盖后内容正确', replaced.products[0].productName === '只剩一行')
}

// ---------------------------------------------------------------------------
section('客户开票信息 CRUD（按客户分组）')
{
  const cid = 6
  const n = db.invoiceInfoByCustomer[cid].length
  const created = await custApi.saveInvoiceInfo({
    customerId: cid,
    title: '直测抬头',
    taxNo: 'TAX123',
    isDefault: true
  })
  ok('新增到该客户名下', db.invoiceInfoByCustomer[cid].length === n + 1)
  ok('设为默认会取消旧的', db.invoiceInfoByCustomer[cid].filter((r) => r.isDefault).length === 1)
  ok('不影响其它客户', db.invoiceInfoByCustomer[7].every((r) => r.title !== '直测抬头'))
  ok('id 全局唯一', new Set(db.allInvoiceInfo().map((r) => r.id)).size === db.allInvoiceInfo().length)

  await custApi.deleteInvoiceInfo(created.id)
  ok('删除只影响本客户', db.invoiceInfoByCustomer[cid].length === n)

  const first = db.invoiceInfoByCustomer[cid][0]
  await custApi.setDefaultInvoiceInfo(first.id)
  ok('设默认生效且唯一', db.invoiceInfoByCustomer[cid].filter((r) => r.isDefault).length === 1)
}

// ---------------------------------------------------------------------------
section('归属流转记录（操作记录 Tab 的数据源）')
{
  const cid = 8
  const before = await custApi.getOwnerChangeLog({ bizType: 2, bizId: cid })
  const target = db.customer.find((c) => c.id === cid)

  await custApi.customerToPool(cid, { reason: '直测放入' })
  const afterPool = await custApi.getOwnerChangeLog({ bizType: 2, bizId: cid })
  ok('放入公海会写一条流转记录', afterPool.length === before.length + 1)
  ok('记录的动作是「放入公海」', afterPool[0].action === '放入公海')
  ok('记录里带原负责人', afterPool[0].fromOwnerName === target.ownerName)
  ok('记录里业务名是快照', afterPool[0].bizName === target.name)

  const poolRow = db.customerPool.find((r) => r.customerId === cid)
  await custApi.assignCustomerFromPool(poolRow.id, { ownerUserId: 5, ownerName: '张三' })
  const afterAssign = await custApi.getOwnerChangeLog({ bizType: 2, bizId: cid })
  ok('分配也会写记录', afterAssign.length === afterPool.length + 1)
  ok('记录里带新负责人', afterAssign[0].toOwnerName === '张三')

  ok('查的是这个客户自己的记录', afterAssign.every((r) => String(r.bizId) === String(cid)))
}

// ---------------------------------------------------------------------------
section('审核后从待审列表摘除')
{
  const row = db.contractAudit[0]
  const n = db.contractAudit.length
  await contractApiAudit(row)
  ok('待审列表 -1', db.contractAudit.length === n - 1)

  async function contractApiAudit(r) {
    const c = await imp('contract.js')
    await c.auditContract(r.contractId ?? r.id, { result: 2, comment: '直测驳回' })
    ok('合同状态变为审核拒绝', db.findById(db.contract, r.contractId ?? r.id).auditStatus === '审核拒绝')
  }
}

// ---------------------------------------------------------------------------
section('财务：提交审核 / 审核 / 开票')
{
  const p = db.payment[0]
  await finApi.submitPayment(p.id)
  ok('提交后状态为财务审核中', db.findById(db.payment, p.id).auditStatus === '财务审核中')

  const inv = db.invoice[0]
  await finApi.submitInvoice(inv.id)
  ok('发票提交后状态为开票中', db.findById(db.invoice, inv.id).status === '开票中')
  await finApi.issueInvoice(inv.id, { invoiceNo: '04599999', issueDate: '2026-09-13' })
  const after = db.findById(db.invoice, inv.id)
  ok('开票后回填发票号', after.invoiceNo === '04599999')
  ok('开票后状态为已开票', after.status === '已开票')
}

// ---------------------------------------------------------------------------
section('报价单：转合同 / 作废（状态闭环）')
{
  // 挑一条「报价中」的报价单：转合同只允许它和「已生成合同」，
  // 挑错了会让后面的断言莫名其妙地失败
  const quoting = db.quotation.find((q) => q.status === '报价中')
  const contractsBefore = db.contract.length

  const contractId = await oppApi.convertQuotationToContract(quoting.id)

  ok('真的建出了一份合同', db.contract.length === contractsBefore + 1)
  const created = db.findById(db.contract, contractId)
  ok('返回的 ID 就是新合同', !!created, `contractId=${contractId}`)
  ok('新合同挂在原报价单的编号上', created?.quotationNo === quoting.quotationNo)
  ok('新合同是未提交的草稿', created?.auditStatus === '未提交')
  ok('新合同出现在合同列表最前面', db.contract[0].id === contractId)

  const afterConvert = db.findById(db.quotation, quoting.id)
  ok('报价单状态变为「已生成合同」', afterConvert.status === '已生成合同')
  ok('报价单上记下了关联合同号', afterConvert.contractNo === created.contractNo)

  // 1:N —— 同一报价单允许重复转换，第二次要再建一份新合同
  const secondId = await oppApi.convertQuotationToContract(quoting.id)
  ok('重复转换会再建一份合同（1:N）', secondId !== contractId && db.contract.length === contractsBefore + 2)

  // 作废：mock 层不拦状态（真正的守卫在后端，出 2252），这里只验证 api 层写穿了
  const anotherQuoting = db.quotation.find((q) => q.status === '报价中')
  await oppApi.voidQuotation(anotherQuoting.id)
  ok('作废后状态变为「已失效」', db.findById(db.quotation, anotherQuoting.id).status === '已失效')

  // mock 的 queryPage 读的是同一个数组 —— 三个状态胶囊能不能查到，
  // 取决于上面的写操作有没有真的落到那个数组上（这正是「假成功」会露馅的地方）
  const expiredPage = await oppApi.getQuotationPage({ scope: 'expired', pageNo: 1, pageSize: 50 })
  ok('「已失效」能查到刚作废的那条', expiredPage.list.some((r) => r.id === anotherQuoting.id))
  const contractedPage = await oppApi.getQuotationPage({ scope: 'contracted', pageNo: 1, pageSize: 50 })
  ok('「已生成合同」能查到转出来的那条', contractedPage.list.some((r) => r.id === quoting.id))
  const quotingPage = await oppApi.getQuotationPage({ scope: 'quoting', pageNo: 1, pageSize: 50 })
  ok('「报价中」里不再有已作废的那条', !quotingPage.list.some((r) => r.id === anotherQuoting.id))
}

// ---------------------------------------------------------------------------
section('发票：一票多回款（选客户联动 → 保存 → 编辑回显 → 作废释放额度）')
{
  // 挑一笔「审核通过且已确认」的回款，它才可能出现在候选里
  const payer = db.payment.find((p) => p.status === 1 && p.customerId)
  const cid = payer.customerId

  const form = await finApi.getInvoiceCustomerForm({ customerId: cid })
  ok('选客户能拿到开票信息', !!form.invoiceInfo?.invoiceTitle, `info=${JSON.stringify(form.invoiceInfo)?.slice(0, 60)}`)
  ok('候选回款都属于该客户', form.payments.every((r) => {
    const p = db.findById(db.payment, r.paymentId)
    return p && String(p.customerId) === String(cid)
  }))
  ok('候选只含审核通过 + 已确认的回款', form.payments.every((r) => {
    const p = db.findById(db.payment, r.paymentId)
    return p && p.status === 1
  }))
  ok('候选都还有可开余额', form.payments.every((r) => r.remainingAmount > 0))

  const target = form.payments[0]
  ok('候选带出了回款编号与余额', !!target?.paymentNo && target.remainingAmount > 0)

  // 存一张只开一半余额的票 —— 留一半给后面的「跨票累计」验证
  const half = Math.round((target.remainingAmount / 2) * 100) / 100
  const invCountBefore = db.invoice.length
  const invId = await finApi.createInvoice({
    invoiceType: 1,
    taxRate: 6,
    applyDate: '2026-09-14',
    remark: '直测一票多回款',
    invoiceTitle: '直测抬头',
    items: [{ paymentId: target.paymentId, writeOffAmount: half }]
  })

  ok('真的建出了一张发票', db.invoice.length === invCountBefore + 1)
  const created = db.findById(db.invoice, invId)
  ok('发票状态是未提交', created?.status === '未提交')
  ok('申请编号自动生成', /^KP\d+$/.test(created?.applyNo || ''), `applyNo=${created?.applyNo}`)
  ok('客户由所选回款推导', String(created?.customerId) === String(cid))
  ok('客户名跟着写对', created?.customerName === db.findById(db.customer, cid)?.name)
  ok('明细落到了 invoicePayment 表', db.invoicePayment.some((ip) => String(ip.invoiceId) === String(invId)))
  ok('价税合计 = Σ 本次开票金额', created?.totalAmount === half, `${created?.totalAmount} vs ${half}`)
  ok('不含税 + 税额 = 价税合计',
    Math.abs((created.amount + created.taxAmount) - created.totalAmount) < 1e-6,
    `${created.amount} + ${created.taxAmount} != ${created.totalAmount}`)

  // 详情要能读出明细（编辑表单靠它回显）
  const detail = await finApi.getInvoiceDetail(invId)
  ok('详情带出 allocations', (detail?.allocations || []).length === 1)
  ok('明细行有回款编号与本次开票金额',
    detail.allocations[0].paymentNo === target.paymentNo &&
    detail.allocations[0].writeOffAmount === half)

  // 额度被占用后，候选里的余额要变少
  const afterForm = await finApi.getInvoiceCustomerForm({ customerId: cid })
  const after = afterForm.payments.find((r) => String(r.paymentId) === String(target.paymentId))
  ok('回款余额被扣减', Math.abs(after.remainingAmount - (target.remainingAmount - half)) < 1e-6,
    `${after.remainingAmount} vs ${target.remainingAmount - half}`)
  // ⚠️ 断言「增量」而不是绝对值 —— 种子数据本来就可能给这笔回款铺过明细，
  //    写死 `allocatedAmount === half` 会被种子数据推翻（那是测试假设错，不是被测逻辑错）。
  ok('已占用金额按本次增量记到了 allocatedAmount',
    Math.abs((after.allocatedAmount - target.allocatedAmount) - half) < 1e-6,
    `${after.allocatedAmount} - ${target.allocatedAmount} != ${half}`)

  // ⚠️ 编辑态传 invoiceId：本票自己占的额度要加回去，否则一打开编辑就少一行
  const editForm = await finApi.getInvoiceCustomerForm({ customerId: cid, invoiceId: invId })
  const inEdit = editForm.payments.find((r) => String(r.paymentId) === String(target.paymentId))
  ok('编辑态把本票占用加回来（被本票占满的行仍可见）',
    Math.abs(inEdit.remainingAmount - target.remainingAmount) < 1e-6,
    `${inEdit.remainingAmount} vs ${target.remainingAmount}`)

  // 提交 → 出现在财务开票页
  await finApi.submitInvoice(invId)
  ok('提交后状态为开票中', db.findById(db.invoice, invId).status === '开票中')
  const pending = await finApi.getInvoiceAuditList({ pageNo: 1, pageSize: 200 })
  ok('财务开票页能查到刚提交的单据（不是模块加载时的快照）',
    pending.list.some((r) => String(r.id ?? r.invoiceId) === String(invId)))

  // 财务开票页的列直接绑这几个字段，字段名/口径错了整列会显示 --
  const pendingRow = pending.list.find((r) => String(r.id) === String(invId))
  ok('待开票行带价税合计（列「本次开票金额」绑 totalAmount 而非不含税的 amount）',
    pendingRow?.totalAmount === half, `${pendingRow?.totalAmount} vs ${half}`)
  ok('待开票行带主键 id（开票接口靠它定位）', pendingRow?.id != null)
  ok('待开票行带发票类型码值（Integer，不是中文）',
    Number.isInteger(pendingRow?.invoiceType), `invoiceType=${pendingRow?.invoiceType}`)
  ok('待开票行带客户名（列「客户名称」）', !!pendingRow?.customerName)
  ok('待开票行带负责人名（列「负责人」）', !!pendingRow?.ownerName)

  // 改明细：整批重建，不能留着旧行
  await finApi.updateInvoice(invId, {
    invoiceType: 1,
    taxRate: 6,
    applyDate: '2026-09-14',
    items: [{ paymentId: target.paymentId, writeOffAmount: half }]
  })
  ok('改明细不会留重复行',
    db.invoicePayment.filter((ip) => String(ip.invoiceId) === String(invId)).length === 1)

  // 作废：额度要放回来（明细保留作审计轨迹）
  await finApi.issueInvoice(invId, { invoiceNo: '04500001', issueDate: '2026-09-14' })
  await finApi.voidInvoice(invId)
  ok('作废后状态为已作废', db.findById(db.invoice, invId).status === '已作废')
  ok('作废后明细仍在（审计轨迹）',
    db.invoicePayment.some((ip) => String(ip.invoiceId) === String(invId)))
  const released = await finApi.getInvoiceCustomerForm({ customerId: cid })
  const back = released.payments.find((r) => String(r.paymentId) === String(target.paymentId))
  ok('作废后额度被释放（回到未开票状态）',
    Math.abs(back.remainingAmount - target.remainingAmount) < 1e-6,
    `${back.remainingAmount} vs ${target.remainingAmount}`)

  // 删除：明细要一并清掉，否则额度永远放不出来
  const realId = await finApi.createInvoice({
    invoiceType: 1, taxRate: 6, applyDate: '2026-09-14',
    items: [{ paymentId: target.paymentId, writeOffAmount: half }]
  })
  await finApi.deleteInvoice(realId)
  ok('删除发票时明细一并清除',
    !db.invoicePayment.some((ip) => String(ip.invoiceId) === String(realId)))
  ok('删除后发票不在列表里', !db.invoice.some((v) => String(v.id) === String(realId)))
}

// ---------------------------------------------------------------------------
section('发票：关注 / 取消关注')
{
  const v = db.invoice[0]
  await finApi.starInvoice(v.id)
  ok('关注写回了 starred', db.findById(db.invoice, v.id).starred === true)
  await finApi.unstarInvoice(v.id)
  ok('取消关注写回了 starred', db.findById(db.invoice, v.id).starred === false)
  const starredPage = await finApi.getInvoicePage({ scope: 'starred', pageNo: 1, pageSize: 200 })
  ok('「我关注的发票」胶囊不再含刚取消的那条',
    !starredPage.list.some((r) => String(r.id) === String(v.id)))

  // 另外两个取数口径胶囊（我负责的 / 下属负责的）也要真的过滤，
  // 不能像以前那样静默不筛、把全量当筛选结果返回。
  const mine = await finApi.getInvoicePage({ scope: 'mine', pageNo: 1, pageSize: 200 })
  ok('「我负责的发票」只含本人',
    mine.list.length > 0 && mine.list.every((r) => r.ownerName === db.MOCK_CURRENT_USER),
    `共 ${mine.list.length} 条，owner 有 ${[...new Set(mine.list.map((r) => r.ownerName))].join('/')}`)
  const sub = await finApi.getInvoicePage({ scope: 'subordinate', pageNo: 1, pageSize: 200 })
  ok('「下属负责的发票」不含本人',
    sub.list.every((r) => r.ownerName !== db.MOCK_CURRENT_USER))
  const all = await finApi.getInvoicePage({ scope: 'all', pageNo: 1, pageSize: 200 })
  ok('全部 = 我负责的 + 下属负责的',
    all.list.length === mine.list.length + sub.list.length,
    `${all.list.length} != ${mine.list.length} + ${sub.list.length}`)
}

// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(52))
console.log(fails.length ? `✗ ${fails.length} 项失败，${pass} 项通过` : `✓ 全部 ${pass} 项通过`)
for (const f of fails) console.log('  · ' + f)
process.exit(fails.length ? 1 : 0)
