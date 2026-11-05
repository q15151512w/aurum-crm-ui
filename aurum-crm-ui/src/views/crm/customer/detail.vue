<template>
  <!--
    客户详情（对应原型「客户详情」页）

    原型有 10 个 Tab：基础信息 / 联系人 / 开票信息 / 商机报价单 / 商机 / 合同 / 回款 / 发票 / 附件 / 操作记录

    数据来源是 GET /crm/customer/{id}/related —— 接口文档 4.3 定义了这个聚合接口，
    10 个 Tab 一次拉取，避免开页面时发 10 个请求。
  -->
  <div v-loading="loading" class="detail">
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.name || '客户详情' }}</h2>
        <el-tag v-if="base.dealStatus" :type="DEAL_STATUS_TAG[base.dealStatus] ?? 'info'" effect="plain">
          {{ DEAL_STATUS_MAP[base.dealStatus] }}
        </el-tag>
      </div>

      <div class="detail__actions">
        <el-button v-permission="'crm:customer:update'" @click="onEdit">编辑</el-button>
        <el-button v-permission="'crm:customer:toPool'" @click="onToPool">放入公海</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="detail__tabs">
      <!-- ---------- 基础信息 ---------- -->
      <el-tab-pane label="基础信息" name="base">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="客户名称">{{ dash(base.name) }}</el-descriptions-item>
          <el-descriptions-item label="客户来源">{{ dash(SOURCE_MAP[base.source]) }}</el-descriptions-item>
          <el-descriptions-item label="客户行业">{{ dash(INDUSTRY_MAP[base.industry]) }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ dash(base.phone) }}</el-descriptions-item>
          <el-descriptions-item label="联系邮箱">{{ dash(base.email) }}</el-descriptions-item>
          <el-descriptions-item label="客户级别">{{ dash(LEVEL_MAP[base.level]) }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ dash(base.ownerName) }}</el-descriptions-item>
          <el-descriptions-item label="最后跟进时间">{{ dash(base.lastFollowTime) }}</el-descriptions-item>
          <el-descriptions-item label="成交状态">{{ dash(DEAL_STATUS_MAP[base.dealStatus]) }}</el-descriptions-item>
          <el-descriptions-item label="地区" :span="2">{{ dash([base.province, base.city, base.district].filter(Boolean).join('')) }}</el-descriptions-item>
          <el-descriptions-item label="详细地址">{{ dash(base.address) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="3">{{ dash(base.createTime) }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <!-- ---------- 联系人 ---------- -->
      <el-tab-pane label="联系人" name="contacts">
        <div class="detail__tab-actions">
          <el-button type="primary" size="large" @click="onAddContact">新增联系人</el-button>
        </div>
        <el-table :data="related.contacts" style="width: 100%">
          <el-table-column prop="name" label="姓名" min-width="120" />
          <el-table-column prop="phone" label="手机号码" min-width="140" />
          <el-table-column prop="title" label="职务" min-width="120" />
          <el-table-column prop="email" label="联系邮箱" min-width="180" />
          <el-table-column prop="gender" label="性别" width="80" />
          <el-table-column prop="wechat" label="微信" min-width="120" />
          <el-table-column label="主联系人" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.primary" type="success" effect="plain" size="small">是</el-tag>
              <el-button v-else link type="primary" @click="onSetPrimaryContact(row)">
                设为主
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="onEditContact(row)">编辑</el-button>
              <el-button link type="danger" @click="onDeleteContact(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ---------- 开票信息 ---------- -->
      <el-tab-pane label="开票信息" name="invoiceInfo">
        <div class="detail__tab-actions">
          <el-button type="primary" size="large" @click="onAddInvoiceInfo">新增开票信息</el-button>
        </div>
        <el-table :data="related.invoiceInfo" style="width: 100%">
          <el-table-column prop="title" label="单位名称" min-width="180" />
          <el-table-column prop="taxNo" label="税号" min-width="200" />
          <el-table-column prop="bankName" label="开户行" min-width="150" />
          <el-table-column prop="bankAccount" label="银行账号" min-width="180" />
          <el-table-column prop="address" label="地址" min-width="180" />
          <el-table-column prop="phone" label="电话" min-width="130" />
          <el-table-column label="默认" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isDefault" type="success" effect="plain" size="small">默认</el-tag>
              <el-button v-else link type="primary" @click="onSetDefaultInvoiceInfo(row)">
                设为默认
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="onEditInvoiceInfo(row)">编辑</el-button>
              <el-button link type="danger" @click="onDeleteInvoiceInfo(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!related.invoiceInfo?.length" description="暂无开票信息" :image-size="80" />
      </el-tab-pane>

      <!-- ---------- 关联单据（结构相同，统一渲染） ---------- -->
      <el-tab-pane
        v-for="tab in LIST_TABS"
        :key="tab.name"
        :label="tab.label"
        :name="tab.name"
      >
        <el-table :data="related[tab.key]" style="width: 100%">
          <el-table-column
            v-for="col in tab.columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :min-width="col.minWidth || 120"
            show-overflow-tooltip
          />
        </el-table>
        <el-empty v-if="!related[tab.key]?.length" :description="`暂无${tab.label}`" :image-size="80" />
      </el-tab-pane>

      <!-- ---------- 操作记录 ---------- -->
      <el-tab-pane label="操作记录" name="timeline">
        <el-timeline class="detail__timeline">
          <el-timeline-item
            v-for="item in ownerLogs"
            :key="item.id"
            :timestamp="item.time"
            placement="top"
          >
            <div class="detail__timeline-item">
              <strong>{{ item.action }}</strong>
              <span class="detail__timeline-op">{{ item.operator }}</span>
              <span class="detail__timeline-remark">{{ item.remark }}</span>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="!ownerLogs.length" description="暂无操作记录" :image-size="80" />
      </el-tab-pane>
    </el-tabs>

    <config-form-dialog
      v-model="visible"
      :title="title"
      :fields="FIELDS"
      :model="form"
      :submitting="submitting"
      width="720px"
      @submit="submit"
    />

    <!-- 联系人 CRUD 复用同一个弹窗组件，字段换成联系人的 -->
    <config-form-dialog
      v-model="contactVisible"
      :title="contactTitle"
      :fields="CONTACT_FIELDS"
      :model="contactForm"
      :submitting="contactSubmitting"
      width="620px"
      @submit="submitContact"
    />

    <!-- 开票信息 CRUD -->
    <config-form-dialog
      v-model="invoiceVisible"
      :title="invoiceTitle"
      :fields="INVOICE_FIELDS"
      :model="invoiceForm"
      :submitting="invoiceSubmitting"
      width="620px"
      @submit="submitInvoice"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import {
  getCustomerDetail, updateCustomer, customerToPool,
  createContact, updateContact, deleteContact, setPrimaryContact,
  saveInvoiceInfo, deleteInvoiceInfo, setDefaultInvoiceInfo
} from '@/api/customer'

/**
 * （归属流转接口 GET /crm/owner-change-log 后端尚未实现，详情页「操作记录」暂空。）
 */
import { useFormDialog } from '@/composables/useFormDialog'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'
// 性别是状态机枚举（值写死在 DDL 注释里，不在 sys_dict_data），仍直接引常量
import { GENDER_OPTIONS } from '@/constants/options'
import { FIELDS, emptyForm } from './form-config'

// 本页用到的字典（预热没跑到或失败过时补一次，正常情况零请求）
ensureDictOptions(['crm_source', 'crm_industry', 'crm_customer_level', 'crm_deal_status'])

/**
 * 码值映射（数据源是 sys_dict_data）
 *
 * ⚠️ 必须是 `useDictMap()` 返回的 computed，不能退回 `Object.fromEntries(...)` 常量 ——
 *    一次性快照会在首屏字典到达前就定格，之后永不更新。
 */
const SOURCE_MAP = useDictMap('crm_source')
const INDUSTRY_MAP = useDictMap('crm_industry')
const LEVEL_MAP = useDictMap('crm_customer_level')
const DEAL_STATUS_MAP = useDictMap('crm_deal_status')

/** 成交状态 → el-tag 类型（对象键会被强制成字符串，数字 / 数字串都命中） */
const DEAL_STATUS_TAG = { 1: 'info', 2: 'success' }

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('base')
const base = ref({})
/** 归属流转记录（操作记录 Tab），走 GET /crm/owner-change-log 单独取 */
const ownerLogs = ref([])
const related = ref({
  contacts: [], invoiceInfo: [], opportunities: [], quotations: [],
  contracts: [], payments: [], invoices: [], attachments: [], timeline: []
})

/**
 * 关联单据 Tab
 *
 * 原型上这几个 Tab 各是一张表，列跟着单据走。这里先按各单据的核心字段给列，
 * 等对应的列表页做完后可以直接复用那边的列定义。
 */
const LIST_TABS = [
  {
    name: 'quotations', key: 'quotations', label: '商机报价单',
    columns: [
      { prop: 'quotationNo', label: '报价单编号' },
      { prop: 'name', label: '报价单名称' },
      { prop: 'quoteDate', label: '报价日期' },
      { prop: 'finalAmount', label: '整单最终价' },
      { prop: 'status', label: '状态' }
    ]
  },
  {
    name: 'opportunities', key: 'opportunities', label: '商机',
    columns: [
      { prop: 'name', label: '商机名称' },
      { prop: 'stage', label: '阶段' },
      { prop: 'expectDealTime', label: '预计成交时间' },
      { prop: 'finalAmount', label: '整单最终价' },
      { prop: 'ownerName', label: '负责人' }
    ]
  },
  {
    name: 'contracts', key: 'contracts', label: '合同',
    columns: [
      { prop: 'contractNo', label: '合同编号' },
      { prop: 'name', label: '合同名称' },
      { prop: 'orderDate', label: '下单日期' },
      { prop: 'finalAmount', label: '整单最终价' },
      { prop: 'status', label: '合同状态' }
    ]
  },
  {
    name: 'payments', key: 'payments', label: '回款',
    columns: [
      { prop: 'paymentNo', label: '回款编号' },
      { prop: 'amount', label: '本次回款金额' },
      { prop: 'payDate', label: '回款日期' },
      { prop: 'payMethod', label: '回款方式' },
      { prop: 'status', label: '状态' }
    ]
  },
  {
    name: 'invoices', key: 'invoices', label: '发票',
    columns: [
      { prop: 'applyNo', label: '发票申请编号' },
      { prop: 'invoiceNo', label: '发票号' },
      { prop: 'amount', label: '本次开票金额' },
      { prop: 'invoiceType', label: '发票类型' },
      { prop: 'status', label: '状态' }
    ]
  },
  {
    name: 'attachments', key: 'attachments', label: '附件',
    columns: [
      { prop: 'name', label: '文件名' },
      { prop: 'size', label: '大小' },
      { prop: 'uploader', label: '上传人' },
      { prop: 'uploadTime', label: '上传时间' }
    ]
  }
]

/** 字段权限会把 phone 等敏感字段脱敏、金额置 null，统一兜底 */
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

async function load() {
  loading.value = true
  try {
    // 基础信息走单接口 GET /crm/customer/{id}；关联单据接口（/related 等）后端尚未实现，
    // 详情页暂只回填基础信息，其余 Tab 保持「暂无」占位。
    const detail = await getCustomerDetail(route.params.id)
    base.value = detail || {}
    related.value = {
      contacts: [], invoiceInfo: [], opportunities: [], quotations: [],
      contracts: [], payments: [], invoices: [], attachments: [], timeline: []
    }
    ownerLogs.value = []
  } catch (e) {
    console.error('[客户详情] 加载失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 表单配置与列表页共用 ./form-config */
const { visible, form, title, submitting, openEdit, submit } = useFormDialog({
  label: '客户',
  emptyForm,
  update: updateCustomer,
  onSuccess: async () => {
    ElMessage.success('修改成功')
    await load()
  }
})

function onEdit() {
  openEdit(base.value)
}

async function onToPool() {
  try {
    await ElMessageBox.confirm(
      '确定把该客户放入公海吗？放入后负责人将被清空。',
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  await customerToPool(route.params.id, { reasonRemark: '手动放入' })
  ElMessage.success('已放入公海')
  await load()
}

// —— 联系人 ——
// 字段按《02-建表文档》crm_contact（customer_id / contact_name / position / phone /
// telephone / email / wechat / gender / is_primary / remark），口径同其它表用展示名。
const CONTACT_FIELDS = [
  { prop: 'name', label: '姓名', type: 'input', required: true, maxlength: 64 },
  { prop: 'title', label: '职务', type: 'input', maxlength: 64 },
  { prop: 'phone', label: '手机号码', type: 'input', maxlength: 32 },
  { prop: 'telephone', label: '座机', type: 'input', maxlength: 32 },
  {
    prop: 'email',
    label: '联系邮箱',
    type: 'input',
    maxlength: 128,
    rules: [{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' }]
  },
  { prop: 'wechat', label: '微信', type: 'input', maxlength: 64 },
  { prop: 'gender', label: '性别', type: 'radio', options: GENDER_OPTIONS },
  {
    prop: 'primary',
    label: '主联系人',
    type: 'switch',
    activeValue: true,
    inactiveValue: false,
    span: 24,
    tip: '一个客户只能有一个主联系人，设为主会自动取消其他的'
  },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, maxlength: 255 }
]

/**
 * 联系人表单
 *
 * 与客户表单同一个弹窗组件，只是换一份 fields。
 * customerId 不在表单里 —— 由「当前是哪个客户」决定，让用户填反而是个出错的机会。
 */
const {
  visible: contactVisible,
  form: contactForm,
  title: contactTitle,
  submitting: contactSubmitting,
  openAdd: openContactAdd,
  openEdit: openContactEdit,
  submit: submitContact
} = useFormDialog({
  label: '联系人',
  emptyForm: () => ({
    name: '',
    title: '',
    phone: '',
    telephone: '',
    email: '',
    wechat: '',
    gender: '男',
    primary: false,
    remark: ''
  }),
  create: (payload) => createContact({ ...payload, customerId: route.params.id }),
  update: updateContact,
  onSuccess: async (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    await load()
  }
})

function onAddContact() {
  openContactAdd()
}

function onEditContact(row) {
  openContactEdit(row)
}

async function onDeleteContact(row) {
  try {
    await ElMessageBox.confirm(`确定删除联系人「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await deleteContact(row.id)
  ElMessage.success('删除成功')
  await load()
}

async function onSetPrimaryContact(row) {
  await setPrimaryContact(row.id)
  ElMessage.success(`已把「${row.name}」设为主联系人`)
  await load()
}

// —— 开票信息 ——
// 字段按《02-建表文档》crm_customer_invoice_info，口径同其它表用展示名
const INVOICE_FIELDS = [
  { prop: 'title', label: '单位名称', type: 'input', required: true, maxlength: 128 },
  { prop: 'taxNo', label: '税号', type: 'input', maxlength: 64 },
  { prop: 'bankName', label: '开户行', type: 'input', maxlength: 128 },
  { prop: 'bankAccount', label: '银行账号', type: 'input', maxlength: 64 },
  { prop: 'address', label: '地址', type: 'input', maxlength: 255 },
  { prop: 'phone', label: '电话', type: 'input', maxlength: 32 },
  {
    prop: 'isDefault',
    label: '设为默认',
    type: 'switch',
    span: 24,
    tip: '一个客户只能有一条默认开票信息，设了会自动取消其它的'
  }
]

const {
  visible: invoiceVisible,
  form: invoiceForm,
  title: invoiceTitle,
  submitting: invoiceSubmitting,
  openAdd: openInvoiceAdd,
  openEdit: openInvoiceEdit,
  submit: submitInvoice
} = useFormDialog({
  label: '开票信息',
  emptyForm: () => ({
    title: '',
    taxNo: '',
    bankName: '',
    bankAccount: '',
    address: '',
    phone: '',
    isDefault: false
  }),
  create: (payload) => saveInvoiceInfo({ ...payload, customerId: route.params.id }),
  update: saveInvoiceInfo,
  onSuccess: async (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    await load()
  }
})

function onAddInvoiceInfo() {
  openInvoiceAdd()
}

function onEditInvoiceInfo(row) {
  openInvoiceEdit(row)
}

async function onDeleteInvoiceInfo(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.title}」的开票信息吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await deleteInvoiceInfo(row.id)
  ElMessage.success('删除成功')
  await load()
}

async function onSetDefaultInvoiceInfo(row) {
  await setDefaultInvoiceInfo(row.id)
  ElMessage.success('已设为默认')
  await load()
}
</script>

<style scoped lang="scss">
.detail {
  min-height: 200px;
}

.detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.detail__title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail__back {
  color: var(--crm-text-secondary);
}

.detail__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.detail__tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }
}

.detail__tab-actions {
  margin-bottom: 12px;
}

.detail__block + .detail__block {
  margin-top: 16px;
}

.detail__timeline {
  padding-left: 4px;
}

.detail__timeline-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.detail__timeline-op {
  color: var(--crm-text-regular);
}

.detail__timeline-remark {
  color: var(--crm-text-secondary);
  font-size: 13px;
}
</style>
