<template>
  <!--
    线索详情（hidden 路由，不出现在侧栏，由列表跳转进入）

    原型只给了线索列表，没有单独的线索详情页设计，这里按线索的字段做基础信息，
    并留出「线索转客户」这个主线关键操作（对应 POST /crm/lead/{id}/convert）。
  -->
  <div v-loading="loading" class="detail">
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.name || '线索详情' }}</h2>
        <el-tag v-if="base.level" effect="plain">{{ LEVEL_MAP[base.level] ?? base.level }}</el-tag>
      </div>

      <div>
        <el-button v-permission="'crm:lead:update'" @click="onEdit">编辑</el-button>
        <el-button v-permission="'crm:lead:toPool'" @click="onToPool">放入线索池</el-button>
        <el-button type="primary" @click="onConvert">线索转客户</el-button>
      </div>
    </div>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="线索名称">{{ dash(base.name) }}</el-descriptions-item>
      <el-descriptions-item label="线索来源">{{ SOURCE_MAP[base.source] ?? '--' }}</el-descriptions-item>
      <el-descriptions-item label="客户行业">{{ INDUSTRY_MAP[base.industry] ?? '--' }}</el-descriptions-item>
      <el-descriptions-item label="联系电话">{{ dash(base.phone) }}</el-descriptions-item>
      <el-descriptions-item label="联系邮箱">{{ dash(base.email) }}</el-descriptions-item>
      <el-descriptions-item label="客户级别">{{ LEVEL_MAP[base.level] ?? '--' }}</el-descriptions-item>
      <el-descriptions-item label="负责人">{{ dash(base.ownerName) }}</el-descriptions-item>
      <el-descriptions-item label="下次联系时间">{{ dash(base.nextContactTime) }}</el-descriptions-item>
      <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
      <el-descriptions-item label="地区" :span="2">{{ dash(base.region) }}</el-descriptions-item>
      <el-descriptions-item label="详细地址">{{ dash(base.address) }}</el-descriptions-item>
      <el-descriptions-item label="备注说明" :span="3">{{ dash(base.remark) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间" :span="3">{{ dash(base.createTime) }}</el-descriptions-item>
    </el-descriptions>

    <!-- 表单配置与列表页共用 ./form-config，两边不会漂移 -->
    <config-form-dialog
      v-model="visible"
      :title="title"
      :fields="FIELDS"
      :model="form"
      :submitting="submitting"
      width="720px"
      @submit="submit"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import { getLeadDetail, convertLead, updateLead, leadToPool } from '@/api/lead'
import { useFormDialog } from '@/composables/useFormDialog'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'
import { FIELDS, emptyForm } from './form-config'

// 本页用到的字典（预热没跑到或失败过时补一次，正常情况零请求）
ensureDictOptions(['crm_source', 'crm_industry', 'crm_customer_level'])

/**
 * 码值映射（数据源是 sys_dict_data）—— 后端返回码值，这里翻成中文
 *
 * ⚠️ 必须是 computed（`useDictMap` 返回的），不能退回常量快照 ——
 *    详情页首屏就渲染，快照会定格在字典到达之前。
 */
const SOURCE_MAP = useDictMap('crm_source')
const INDUSTRY_MAP = useDictMap('crm_industry')
const LEVEL_MAP = useDictMap('crm_customer_level')

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const base = ref({})

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/**
 * 编辑
 *
 * 详情对象比表单大（带 creator / createTime 等），但 useFormDialog 回填时会按
 * emptyForm 的字段裁剪，所以直接整坨传进去也不会污染提交的 payload。
 */
const { visible, form, title, submitting, openEdit, submit } = useFormDialog({
  label: '线索',
  emptyForm,
  update: updateLead,
  onSuccess: async () => {
    ElMessage.success('修改成功')
    await load()
  }
})

function onEdit() {
  openEdit(base.value)
}

/**
 * 放入线索池
 *
 * 与列表页的批量版本同一套规则：只确认、不强制填写放入原因。
 */
async function onToPool() {
  try {
    await ElMessageBox.confirm(
      '确定把该线索放入线索池吗？',
      '放入线索池',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  // 显式发一个空对象：ToLeadPoolReqDTO 的 reasonCode / reasonRemark 都可选，
  // 两者均为 null → 进池原因记为 NULL。
  // ⚠️ 不要省掉请求体：request.js 默认带 Content-Type: application/json，
  //    POST + 该类型 + 空 body 会被 Spring 判成 415，而不是当成 null 放行。
  await leadToPool(route.params.id, {})
  ElMessage.success('已放入线索池')
  await load()
}

/** 线索转客户 —— LTC 主线的关键节点 */
async function onConvert() {
  try {
    await ElMessageBox.confirm(
      '转客户后该线索将标记为已转化，并生成一条对应客户记录。确定继续吗？',
      '线索转客户',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  await convertLead(route.params.id, {})
  ElMessage.success('已转为客户')
  router.push('/crm/customer')
}

async function load() {
  loading.value = true
  try {
    base.value = (await getLeadDetail(route.params.id)) || {}
  } catch (e) {
    console.error('[线索详情] 加载失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
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
  margin-bottom: 16px;
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
</style>
