import { dictOptions } from '@/composables/useDictOptions'

/**
 * 回款的新增/编辑表单配置
 *
 * 列表页与详情页共用（理由见 crm/lead/form-config.js 的注释）。
 *
 * 状态字段（status）不出现在表单里 —— 它由「提交审核」「财务审核」这些业务动作驱动，
 * 不是人手填的（《建表文档》4.2 把 audit_status / status 都标成流程字段）。
 */
export const FIELDS = [
  {
    prop: 'paymentNo',
    label: '回款编号',
    type: 'readonly',
    tip: '保存时由编号规则引擎自动生成'
  },
  {
    prop: 'contractName',
    label: '关联合同',
    type: 'selector',
    selector: 'contract',
    extraProp: 'contractId',
    required: true,
    onSelect: (model, row) => {
      model.contractName = row?.name ?? row?.contractName ?? ''
      model.contractId = row?.id ?? null
      model.customerName = row?.customerName ?? ''
      model.customerId = row?.customerId ?? null
    }
  },
  { prop: 'customerName', label: '客户名称', type: 'readonly' },
  {
    prop: 'amount',
    label: '本次回款金额',
    type: 'number',
    required: true,
    precision: 2,
    step: 100
  },
  {
    prop: 'paymentDate',
    label: '回款日期',
    type: 'date',
    required: true
  },
  {
    prop: 'paymentMethod',
    label: '回款方式',
    type: 'select',
    options: () => dictOptions('fin_payment_method'),
    required: true
  },
  { prop: 'accountName', label: '收款账户名', type: 'input', maxlength: 128 },
  { prop: 'accountNo', label: '收款账号', type: 'input', maxlength: 64 },
  { prop: 'serialNo', label: '银行流水号', type: 'input', maxlength: 128 },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 255 }
]

export const emptyForm = () => ({
  paymentNo: '',
  customerName: '',
  customerId: null,
  contractId: null,
  contractName: '',
  amount: 0,
  paymentDate: '',
  paymentMethod: 1,
  accountName: '',
  accountNo: '',
  serialNo: '',
  remark: ''
})
