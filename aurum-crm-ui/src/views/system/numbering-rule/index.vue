<template>
  <div class="numbering-page">
    <div class="numbering-page__head">
      <div>
        <h2>编号定义</h2>
        <p>编号项顺序和流水依据保存后，下一张业务单据立即使用新规则。</p>
      </div>
      <div class="numbering-page__actions">
        <el-button v-if="form.id" text type="danger" title="删除当前规则" @click="deleteCurrent">
          <el-icon><Delete /></el-icon>删除
        </el-button>
        <el-button type="primary" :loading="saving" @click="saveCurrent">
          <el-icon><Check /></el-icon>保存
        </el-button>
      </div>
    </div>

    <div class="numbering-page__body">
      <aside class="rule-sidebar">
        <div class="rule-sidebar__head">
          <span>编号规则</span>
          <div class="rule-sidebar__tools">
            <el-icon title="新增编号" @click="openAdd"><Plus /></el-icon>
          </div>
        </div>
        <button
          v-for="rule in rules"
          :key="rule.id"
          type="button"
          class="rule-sidebar__item"
          :class="{ 'is-active': selected?.id === rule.id }"
          @click="selectRule(rule)"
        >
          <span>{{ rule.name }}</span><small>{{ rule.code }}</small>
        </button>
        <div v-if="!rules.length" class="rule-sidebar__empty">暂无编号规则</div>
      </aside>

      <main class="numbering-content">
        <section class="barcode-panel">
          <div class="barcode" :aria-label="previewNo"></div>
          <div class="barcode-value">
            <span v-for="(part, index) in previewParts" :key="`${part.id}-${index}`">{{ part.value }}</span>
          </div>
          <div class="preview-caption">示例编号：{{ previewNo }}</div>
        </section>

        <section class="segment-board">
          <div v-if="!form.items.length" class="segment-board__empty">请在右侧新增编号项</div>
          <div v-for="item in form.items" :key="item.id" class="segment-card">
            <div class="segment-card__label">{{ itemLabel(item) }}</div>
            <el-input :model-value="previewItemValue(item)" disabled />
            <div class="segment-card__switch">
              <span>是否流水依据</span>
              <el-switch v-model="item.sequenceBasis" :disabled="item.type === 'SERIAL' || item.type === 'FIXED_PREFIX'" />
            </div>
          </div>
        </section>
      </main>

      <aside class="rule-editor">
        <el-form v-if="form.id" label-position="top">
          <el-form-item label="规则名称" required>
            <el-input v-model="form.name" maxlength="64" placeholder="请输入规则名称" />
          </el-form-item>
          <el-form-item label="规则编号" required>
            <el-input :model-value="form.code" disabled />
          </el-form-item>
          <el-form-item label="流水周期">
            <el-radio-group v-model="form.resetCycle" class="cycle-buttons" @change="applyResetCycle">
              <el-radio-button label="按日" />
              <el-radio-button label="按月" />
              <el-radio-button label="按年" />
              <el-radio-button label="不重置" />
              <el-radio-button label="按客户/部门" />
            </el-radio-group>
          </el-form-item>
        </el-form>

        <div v-if="form.id" class="rule-editor__title">
          <span>编号项</span>
          <el-button type="primary" link @click="addItem"><el-icon><Plus /></el-icon>新增</el-button>
        </div>
        <div v-if="form.id" class="segment-options" @dragover.prevent>
          <div
            v-for="(item, index) in form.items"
            :key="item.id"
            class="segment-option"
            :class="{ 'is-fixed': item.type === 'FIXED_PREFIX', 'is-dragging': draggingId === item.id }"
            draggable="true"
            @dragstart="startDrag(item)"
            @dragend="endDrag"
            @dragover.prevent
            @drop="dropItem(index)"
          >
            <el-icon class="drag-handle" title="拖拽排序"><Rank /></el-icon>
            <div class="segment-option__fields">
              <el-select v-model="item.type" :disabled="item.type === 'FIXED_PREFIX'" @change="typeChanged(item)">
                <el-option v-for="option in ITEM_OPTIONS" :key="option.type" :label="option.label" :value="option.type" />
              </el-select>
              <el-input
                v-if="item.type === 'FIXED_VALUE' || item.type === 'FIXED_PREFIX' || item.type === 'DATE'"
                v-model="item.value"
                :disabled="item.type === 'FIXED_PREFIX'"
                :placeholder="item.type === 'DATE' ? '如 yyyyMMdd' : '固定值'"
              />
              <el-input-number v-else-if="item.type === 'SERIAL'" v-model="item.length" :min="1" :max="10" controls-position="right" />
              <span v-else class="segment-option__preview">{{ previewItemValue(item) }}</span>
            </div>
            <el-switch v-model="item.sequenceBasis" :disabled="item.type === 'SERIAL' || item.type === 'FIXED_PREFIX'" title="是否流水依据" />
            <el-icon v-if="canDeleteItem(item)" class="remove-item" title="删除编号项" @click="removeItem(index)"><Delete /></el-icon>
            <el-icon v-else class="locked-item" title="固定项或唯一流水项不可删除"><Lock /></el-icon>
          </div>
        </div>
        <div v-if="form.id" class="rule-editor__hint">拖动左侧握柄调整顺序；固定前缀由系统保护，流水号至少保留一项。</div>
      </aside>
    </div>

    <el-dialog v-model="addVisible" title="新增编号规则" width="460px">
      <el-form :model="addForm" label-position="top">
        <el-form-item label="规则名称" required><el-input v-model="addForm.name" placeholder="请输入规则名称" /></el-form-item>
        <el-form-item label="规则编号" required>
          <el-select v-model="addForm.code" placeholder="请选择规则编号" style="width: 100%">
            <el-option v-for="item in availableCodes" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="createRule">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Delete, Lock, Plus, Rank } from '@element-plus/icons-vue'
import { createNumberingRule, deleteNumberingRule, getNumberingRulePage, updateNumberingRule } from '@/api/system'
import { RULE_CODE_OPTIONS } from '@/constants/options'

const PREFIXES = { LEAD: 'XS', CUSTOMER: 'KH', OPP: 'SJ', QUOTE: 'BJ', CONTRACT: 'HT', PAYMENT: 'HK', INVOICE: 'FP' }
const LENGTHS = { LEAD: 4, CUSTOMER: 4, OPP: 4, QUOTE: 4, CONTRACT: 6, PAYMENT: 6, INVOICE: 6 }
const ITEM_OPTIONS = [
  { type: 'FIXED_PREFIX', label: '固定前缀' }, { type: 'FIXED_VALUE', label: '固定值' },
  { type: 'YEAR', label: '年（4位）' }, { type: 'YEAR_SHORT', label: '年（2位）' },
  { type: 'MONTH', label: '月（2位）' }, { type: 'DAY', label: '日（2位）' },
  { type: 'DATE', label: '日期格式' }, { type: 'CUSTOMER', label: '客户' },
  { type: 'DEPARTMENT', label: '部门' }, { type: 'SERIAL', label: '流水号' }
]

const rules = ref([])
const selected = ref(null)
const saving = ref(false)
const draggingId = ref(null)
const form = reactive({ id: null, name: '', code: '', prefix: '', dateFormat: 'yyyyMMdd', seqLength: 4, resetCycle: '按日', enabled: true, items: [] })
const addVisible = ref(false)
const adding = ref(false)
const addForm = reactive({ name: '', code: '' })

const availableCodes = computed(() => RULE_CODE_OPTIONS.filter((item) => !rules.value.some((rule) => rule.code === item.value)))
const previewParts = computed(() => form.items.map((item) => ({ id: item.id, value: previewItemValue(item) })))
const previewNo = computed(() => previewParts.value.map((item) => item.value).join(''))

function defaultItems(code, resetCycle = '按日') {
  const basis = resetCycle === '按年' ? ['YEAR'] : resetCycle === '按月' ? ['YEAR', 'MONTH'] : resetCycle === '按日' ? ['YEAR', 'MONTH', 'DAY'] : []
  return [
    makeItem('FIXED_PREFIX', PREFIXES[code] || '', null, false),
    makeItem('YEAR', '', null, basis.includes('YEAR')),
    makeItem('MONTH', '', null, basis.includes('MONTH')),
    makeItem('DAY', '', null, basis.includes('DAY')),
    makeItem('SERIAL', '', LENGTHS[code] || 4, true)
  ]
}

function makeItem(type, value = '', length = null, sequenceBasis = false) {
  return { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, value, length, sequenceBasis }
}

function cloneItems(items, code, resetCycle) {
  const source = Array.isArray(items) && items.length ? items : defaultItems(code, resetCycle)
  return source.map((item, index) => ({
    id: item.id ?? `item-${Date.now()}-${index}`,
    type: String(item.type || 'FIXED_VALUE').toUpperCase(), value: item.value ?? '',
    length: item.length ?? (String(item.type).toUpperCase() === 'SERIAL' ? LENGTHS[code] || 4 : null),
    sequenceBasis: Boolean(item.sequenceBasis), sort: index
  }))
}

function copyRuleToForm(rule) {
  Object.assign(form, { id: rule.id, name: rule.name, code: rule.code, prefix: rule.prefix, dateFormat: rule.dateFormat || 'yyyyMMdd', seqLength: rule.seqLength || LENGTHS[rule.code] || 4, resetCycle: rule.resetCycle || '按日', enabled: rule.enabled !== false, items: cloneItems(rule.items, rule.code, rule.resetCycle || '按日') })
}

function selectRule(rule) { selected.value = rule; copyRuleToForm(rule) }

async function loadRules() {
  const data = await getNumberingRulePage({ pageNo: 1, pageSize: 100 })
  rules.value = data?.list || []
  if (rules.value.length) selectRule(rules.value[0])
  else Object.assign(form, { id: null, name: '', code: '', items: [] })
}

function itemLabel(item) { return ITEM_OPTIONS.find((option) => option.type === item.type)?.label || item.type }

function previewItemValue(item) {
  const now = new Date()
  switch (item.type) {
    case 'FIXED_PREFIX': case 'FIXED_VALUE': return item.value || ''
    case 'YEAR': return String(now.getFullYear())
    case 'YEAR_SHORT': return String(now.getFullYear()).slice(-2)
    case 'MONTH': return String(now.getMonth() + 1).padStart(2, '0')
    case 'DAY': return String(now.getDate()).padStart(2, '0')
    case 'DATE': return formatDate(item.value || 'yyyyMMdd', now)
    case 'CUSTOMER': return '{客户}'
    case 'DEPARTMENT': return '{部门}'
    case 'SERIAL': return String(1).padStart(Number(item.length) || 4, '0')
    default: return ''
  }
}

function formatDate(pattern, date) {
  return pattern.replace(/yyyy/g, String(date.getFullYear())).replace(/yy/g, String(date.getFullYear()).slice(-2)).replace(/MM/g, String(date.getMonth() + 1).padStart(2, '0')).replace(/dd/g, String(date.getDate()).padStart(2, '0'))
}

function addItem() { form.items.push(makeItem('FIXED_VALUE', '', null, false)) }
function canDeleteItem(item) { return item.type !== 'FIXED_PREFIX' && !(item.type === 'SERIAL' && form.items.filter((entry) => entry.type === 'SERIAL').length <= 1) }
function removeItem(index) { if (canDeleteItem(form.items[index])) form.items.splice(index, 1) }
function typeChanged(item) { if (item.type === 'SERIAL') { item.length = item.length || form.seqLength || 4; item.sequenceBasis = true } else if (item.type === 'DATE') item.value = item.value || 'yyyyMMdd' }
function startDrag(item) { draggingId.value = item.id }
function endDrag() { draggingId.value = null }
function dropItem(index) {
  const from = form.items.findIndex((item) => item.id === draggingId.value)
  if (from < 0 || from === index) return endDrag()
  const [moved] = form.items.splice(from, 1); form.items.splice(index, 0, moved); endDrag()
}

function applyResetCycle(value) {
  const basis = value === '按年' ? ['YEAR'] : value === '按月' ? ['YEAR', 'MONTH'] : value === '按日' ? ['YEAR', 'MONTH', 'DAY'] : []
  form.items.forEach((item) => { if (['YEAR', 'MONTH', 'DAY'].includes(item.type)) item.sequenceBasis = basis.includes(item.type) })
  if (value === '按客户/部门') {
    let businessBasis = form.items.find((item) => item.type === 'CUSTOMER' || item.type === 'DEPARTMENT')
    if (!businessBasis) {
      const serialIndex = form.items.findIndex((item) => item.type === 'SERIAL')
      businessBasis = makeItem('CUSTOMER', '', null, true)
      form.items.splice(serialIndex < 0 ? form.items.length : serialIndex, 0, businessBasis)
    }
    businessBasis.sequenceBasis = true
  } else {
    form.items.forEach((item) => { if (['CUSTOMER', 'DEPARTMENT'].includes(item.type)) item.sequenceBasis = false })
  }
}

function payloadItems() { return form.items.map((item, index) => ({ id: typeof item.id === 'number' ? item.id : undefined, type: item.type, value: item.value || null, length: item.type === 'SERIAL' ? Number(item.length) || form.seqLength || 4 : null, sort: index, sequenceBasis: Boolean(item.sequenceBasis) })) }

async function saveCurrent() {
  if (!form.id) return
  if (!form.name.trim()) return ElMessage.warning('请输入规则名称')
  if (form.items.filter((item) => item.type === 'SERIAL').length !== 1) return ElMessage.warning('请保留且仅保留一个流水号节点')
  saving.value = true
  try {
    await updateNumberingRule(form.id, { name: form.name.trim(), code: form.code, prefix: PREFIXES[form.code], dateFormat: form.dateFormat, seqLength: form.seqLength, resetCycle: form.resetCycle, items: payloadItems() })
    const row = rules.value.find((item) => item.id === form.id)
    if (row) Object.assign(row, { name: form.name.trim(), items: form.items.map((item, index) => ({ ...item, sort: index })) })
    ElMessage.success('保存成功，下一张单据将使用新规则')
  } finally { saving.value = false }
}

async function deleteCurrent() {
  if (!form.id) return
  try {
    await ElMessageBox.confirm('删除后该编号规则将停止生成新编号，历史单据编号不会被修改。确定继续吗？', '删除编号规则', { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' })
    await deleteNumberingRule(form.id); await loadRules(); ElMessage.success('删除成功')
  } catch { /* 用户取消 */ }
}

function openAdd() { Object.assign(addForm, { name: '', code: availableCodes.value[0]?.value || '' }); addVisible.value = true }
async function createRule() {
  if (!addForm.name.trim() || !addForm.code) return ElMessage.warning('请填写规则名称并选择规则编号')
  adding.value = true
  try {
    const created = await createNumberingRule({ name: addForm.name.trim(), code: addForm.code, prefix: PREFIXES[addForm.code], dateFormat: 'yyyyMMdd', seqLength: LENGTHS[addForm.code] || 4, resetCycle: '按日', items: defaultItems(addForm.code, '按日').map((item, index) => ({ type: item.type, value: item.value || null, length: item.length, sort: index, sequenceBasis: item.sequenceBasis })) })
    addVisible.value = false; await loadRules(); const id = typeof created === 'object' ? created.id : created; const row = rules.value.find((item) => String(item.id) === String(id)); if (row) selectRule(row); ElMessage.success('新增成功')
  } finally { adding.value = false }
}

onMounted(loadRules)
</script>

<style scoped lang="scss">
.numbering-page { min-height: calc(100vh - 96px); padding: 20px 24px; background: #f3f5f8; color: #1f2937; }
.numbering-page__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; h2 { margin: 0; font-size: 22px; font-weight: 600; } p { margin: 5px 0 0; color: #94a3b8; font-size: 13px; } }
.numbering-page__actions { display: flex; gap: 8px; }
.numbering-page__body { display: grid; grid-template-columns: 210px minmax(480px, 1fr) 360px; gap: 18px; min-height: 760px; }
.rule-sidebar, .rule-editor, .barcode-panel, .segment-board { background: #fff; border: 1px solid #e5eaf0; box-shadow: 0 2px 8px rgb(15 23 42 / 3%); }
.rule-sidebar { padding: 14px 0; }
.rule-sidebar__head { display: flex; justify-content: space-between; align-items: center; padding: 0 16px 12px; color: #64748b; font-size: 13px; }
.rule-sidebar__tools { display: flex; gap: 12px; color: #2563eb; cursor: pointer; }
.rule-sidebar__item { width: 100%; display: flex; justify-content: space-between; align-items: center; border: 0; border-left: 3px solid transparent; padding: 12px 16px; background: transparent; color: #334155; text-align: left; cursor: pointer; }
.rule-sidebar__item small { color: #94a3b8; font-size: 11px; }
.rule-sidebar__item.is-active { border-left-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
.rule-sidebar__empty, .segment-board__empty { padding: 30px 16px; text-align: center; color: #94a3b8; font-size: 13px; }
.numbering-content { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.barcode-panel { padding: 28px 24px 20px; text-align: center; }
.barcode { height: 92px; background: repeating-linear-gradient(90deg, #111827 0 2px, transparent 2px 5px, #111827 5px 6px, transparent 6px 10px); opacity: .85; }
.barcode-value { display: flex; justify-content: center; gap: 0; margin-top: 14px; color: #0f172a; font: 600 18px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 1px; }
.preview-caption { margin-top: 8px; color: #94a3b8; font-size: 12px; }
.segment-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; padding: 16px; align-content: start; }
.segment-card { min-width: 0; padding: 14px; border: 1px solid #e5eaf0; background: #fbfdff; }
.segment-card__label { margin-bottom: 8px; color: #64748b; font-size: 12px; }
.segment-card__switch { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; color: #64748b; font-size: 12px; }
.rule-editor { padding: 20px; }
.rule-editor__title { display: flex; align-items: center; justify-content: space-between; margin: 20px 0 10px; color: #334155; font-size: 14px; font-weight: 600; }
.segment-options { display: flex; flex-direction: column; gap: 8px; }
.segment-option { display: flex; align-items: center; gap: 7px; padding: 9px 8px; border: 1px solid #e5eaf0; background: #fff; transition: border-color .15s, background .15s; }
.segment-option:hover, .segment-option.is-dragging { border-color: #93c5fd; background: #f8fbff; }
.segment-option.is-fixed { background: #f8fafc; }
.drag-handle { flex: 0 0 auto; color: #94a3b8; cursor: grab; }
.segment-option__fields { display: grid; grid-template-columns: minmax(108px, 1fr) minmax(84px, 1fr); align-items: center; gap: 6px; min-width: 0; flex: 1; }
.segment-option__preview { overflow: hidden; color: #64748b; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.remove-item { flex: 0 0 auto; color: #ef4444; cursor: pointer; }
.locked-item { flex: 0 0 auto; color: #cbd5e1; }
.cycle-buttons { display: flex; flex-wrap: wrap; width: 100%; }
.cycle-buttons :deep(.el-radio-button__inner) { padding: 7px 10px; }
.rule-editor__hint { margin-top: 12px; color: #94a3b8; font-size: 12px; line-height: 1.6; }
@media (max-width: 1180px) { .numbering-page__body { grid-template-columns: 180px minmax(380px, 1fr); } .rule-editor { grid-column: 1 / -1; } }
@media (max-width: 720px) { .numbering-page { padding: 14px; } .numbering-page__head { align-items: flex-start; gap: 12px; flex-direction: column; } .numbering-page__body { display: flex; flex-direction: column; min-height: 0; } .rule-sidebar { order: 0; } .numbering-content { order: 1; } .rule-editor { order: 2; } .segment-board { grid-template-columns: 1fr 1fr; } }
</style>
