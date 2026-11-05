import { dictOptions } from '@/composables/useDictOptions'
import { getLeadDetail } from '@/api/lead'

/**
 * 客户的新增/编辑表单配置（对接真实后端 DDL 字段）
 *
 * 列表页与详情页共用（理由见 lead/form-config.js 的注释）。
 *
 * 字段名与后端 CustomerSaveReqVO 对齐：
 *   customerName / leadId / source(码值) / ownerUserId(负责人) / level(码值) /
 *   industry(码值) / dealStatus(码值) / phone / email / website /
 *   province / city / district / address / remark
 *
 * ⚠️ 四个字典字段的 `options` 都写成**函数**（`() => dictOptions('xxx')`），
 *    不要改回直接引常量。`FormField.vue` 的 `resolve()` 会调用它，
 *    这样字典管理页改了字典、下拉立刻跟着变。
 *    也**不能返回 computed** —— resolve 不解包 ref，v-for 会遍历一个 ref 对象、得到空下拉。
 */

/**
 * 「选择线索去新增」：选中一条线索后，把它能对齐的字段一键填进客户表单，
 * 并把线索 ID 写进 leadId 建立溯源（后端 crm_customer.lead_id）。
 *
 * 线索选择器只返回 { id, name, phone, ownerName }，行业/来源/级别/地址/邮箱这些
 * 在详情里才有，所以选中后懒调一次 {@code getLeadDetail}。填写有竞态：
 * 等待详情响应的间隙里用户可能又改选了线索，套用前先比对 leadId 是否仍是选中那条。
 */
async function onLeadPicked(model, row) {
  model.leadName = row?.name ?? ''
  model.leadId = row?.id ?? null
  if (!row?.id) return
  const pickedId = row.id
  try {
    const d = await getLeadDetail(pickedId)
    if (!d || String(model.leadId) !== String(pickedId)) return
    model.customerName = d.leadName ?? d.name ?? model.customerName
    model.source = d.source ?? null
    model.industry = d.industry ?? null
    model.level = d.level ?? null
    model.phone = d.phone ?? ''
    model.email = d.email ?? ''
    model.region = d.region ?? ''
    model.address = d.address ?? ''
    model.ownerName = d.ownerName ?? model.ownerName
    model.ownerUserId = d.ownerUserId ?? model.ownerUserId
    model.remark = d.remark ?? ''
  } catch {
    // 失败提示已由 request.js 统一弹出；这里保留已填的 leadId，用户可手动补全客户字段
  }
}
export const FIELDS = [
  {
    prop: 'leadName',
    label: '选择线索',
    type: 'selector',
    selector: 'lead',
    span: 24,
    placeholder: '从已有线索带出客户信息（可不选）',
    tip: '选择已有线索会一键带出客户名称 / 来源 / 行业 / 级别 / 电话 / 邮箱 / 地区 / 负责人等信息，并建立溯源；也可不选、手动填写客户',
    onSelect: onLeadPicked
  },
  {
    prop: 'customerName',
    label: '客户名称',
    type: 'input',
    required: true,
    maxlength: 128,
    placeholder: '公司全称'
  },
  {
    prop: 'source',
    label: '客户来源',
    type: 'select',
    options: () => dictOptions('crm_source')
  },
  {
    prop: 'ownerName',
    label: '负责人',
    type: 'selector',
    selector: 'salesOwner',
    extraProp: 'ownerUserId'
  },
  {
    prop: 'level',
    label: '客户级别',
    type: 'select',
    options: () => dictOptions('crm_customer_level')
  },
  {
    prop: 'industry',
    label: '客户行业',
    type: 'select',
    options: () => dictOptions('crm_industry')
  },
  {
    prop: 'dealStatus',
    label: '成交状态',
    type: 'select',
    options: () => dictOptions('crm_deal_status')
  },
  { prop: 'phone', label: '联系电话', type: 'input', maxlength: 32 },
  {
    prop: 'email',
    label: '联系邮箱',
    type: 'input',
    maxlength: 128,
    rules: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
  },
  { prop: 'website', label: '官网', type: 'input', maxlength: 255 },
  { prop: 'region', label: '地区', type: 'region', span: 24 },
  { prop: 'address', label: '详细地址', type: 'input', span: 24, maxlength: 255 },
  { prop: 'remark', label: '备注说明', type: 'textarea', span: 24, maxlength: 500 }
]

export const emptyForm = () => ({
  leadName: '',
  leadId: null,
  customerName: '',
  source: null,
  ownerName: '',
  ownerUserId: null,
  level: null,
  industry: null,
  dealStatus: 1,
  phone: '',
  email: '',
  website: '',
  region: '',
  address: '',
  remark: ''
})
