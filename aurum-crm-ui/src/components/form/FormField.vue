<template>
  <!--
    单个表单字段的渲染器

    按 field.type 分发到不同的控件。15 个表单的字段全部走这里，
    新增一种控件时只改这一个文件。

    ⚠️ 为什么是「传整个 model 进来」而不是 v-model
       有些控件选中后要顺带回写别的字段（部门选中要填 deptName、
       产品选中要带出单位/单价），用 update:modelValue 表达不了。
       直接把表单对象传进来，字段自己写 `model[prop]`，少一层转发。
  -->

  <!-- 只读回显（如编号规则的当前流水、开票日期这类后端回填字段） -->
  <span v-if="type === 'readonly'" class="form-field__readonly">{{ displayValue }}</span>

  <!--
    只读状态标签：与列表页的 el-tag 同款（报价单 / 合同的状态这类只读枚举值）

    存在的理由：同一个「报价中」，列表里是橙色 tag，弹窗里若只写纯文字就成了黑字，
    两处颜色对不上。用 type: 'statusTag' + tagType 复用**列表那份颜色映射**，
    颜色就只剩一个来源，不会再漂移。
  -->
  <el-tag
    v-else-if="type === 'statusTag'"
    :type="tagType"
    effect="plain"
    size="small"
  >{{ displayValue }}</el-tag>

  <!--
    分区标题（发票登记的「发票信息」）

    ⚠️ 这类字段**不写 `prop`** —— 它不绑定任何数据，纯装饰。
    正好绕开了 check-static 的两条规则：type 检查靠 `v-else-if="type === 'xxx'"`
    的写法被自动登记；prop 检查只扫带 `prop: '...'` 的条目，无 prop 即不参与
    「prop 是否进了 emptyForm」的对账，也就不会逼着往 emptyForm 里塞一个假字段。
  -->
  <template v-else-if="type === 'section'">
    <div class="form-field__section">{{ field.label }}</div>
  </template>

  <el-input
    v-else-if="type === 'input'"
    v-model="value"
    :placeholder="placeholder"
    :disabled="isDisabled"
    :maxlength="field.maxlength"
    :show-word-limit="!!field.maxlength"
    clearable
  />

  <el-input
    v-else-if="type === 'password'"
    v-model="value"
    type="password"
    show-password
    :placeholder="placeholder"
    :disabled="isDisabled"
    :maxlength="field.maxlength"
  />

  <el-input
    v-else-if="type === 'textarea'"
    v-model="value"
    type="textarea"
    :rows="field.rows || 3"
    :placeholder="placeholder"
    :disabled="isDisabled"
    :maxlength="field.maxlength"
    :show-word-limit="!!field.maxlength"
  />

  <el-input-number
    v-else-if="type === 'number'"
    v-model="value"
    :min="field.min ?? 0"
    :max="field.max"
    :precision="field.precision ?? 0"
    :step="field.step ?? 1"
    :disabled="isDisabled"
    :placeholder="placeholder"
    controls-position="right"
    class="form-field__number"
  />

  <el-select
    v-else-if="type === 'select'"
    v-model="value"
    :placeholder="placeholder"
    :disabled="isDisabled"
    :multiple="!!field.multiple"
    clearable
    filterable
    @change="onChange"
  >
    <el-option
      v-for="opt in resolve(field.options) || []"
      :key="opt.value"
      :label="opt.label"
      :value="opt.value"
    />
  </el-select>

  <el-radio-group v-else-if="type === 'radio'" v-model="value" :disabled="isDisabled">
    <el-radio v-for="opt in resolve(field.options) || []" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </el-radio>
  </el-radio-group>

  <el-switch
    v-else-if="type === 'switch'"
    v-model="value"
    :disabled="isDisabled"
    :active-value="field.activeValue ?? true"
    :inactive-value="field.inactiveValue ?? false"
  />

  <el-date-picker
    v-else-if="type === 'date'"
    v-model="value"
    type="date"
    value-format="YYYY-MM-DD"
    :placeholder="placeholder || '请选择日期'"
    :disabled="isDisabled"
  />

  <el-date-picker
    v-else-if="type === 'datetime'"
    v-model="value"
    type="datetime"
    value-format="YYYY-MM-DD HH:mm:ss"
    :placeholder="placeholder || '请选择时间'"
    :disabled="isDisabled"
  />

  <!-- 明细行编辑器（报价单 / 合同的产品明细） -->
  <product-item-editor v-else-if="type === 'items'" v-model="value" />

  <!--
    回款分摊明细（发票登记）：「一张票合并多笔回款」，每行填本次开票金额。

    ⚠️ 这里比其它自定义编辑器多传一个 `:model` —— 子表需要父表单的 customerId
    才能去拉该客户的可开票回款。`items` / `pdfUpload` 只传 v-model 是因为它们
    自给自足（产品选项来自独立接口），本控件不行。

    ⚠️ 写法必须与上面保持一致（`v-else-if="type === 'xxx'"`）：
    scripts/check-static.mjs 用正则从这个文件里提取已注册的 type 去和页面的
    form-config 对账，换成别的写法会让它误报「未注册的字段类型」。
  -->
  <invoice-payment-editor v-else-if="type === 'paymentAllocation'" v-model="value" :model="model" />

  <!-- 单图上传（产品图片）：上传即拿到 URL，值就是表单里的 imageUrl 字符串 -->
  <product-image-upload
    v-else-if="type === 'imageUpload'"
    v-model="value"
    :disabled="isDisabled"
  />

  <!--
    圆形单图上传（个人资料的头像）：值就是表单里的 avatar 字符串。

    ⚠️ 与上面 imageUpload 是**两个**控件，不要合并：产品图片走专用接口
    `/crm/product/image` 且值存进 `crm_product.image`；头像走通用
    `/system/file/upload` 且值存进 `sys_user.avatar`。上传目标不同，合并只会
    把「产品图片限 gif、头像不许 gif」这类差异做成一个到处是 if 的控件。
  -->
  <avatar-upload
    v-else-if="type === 'avatarUpload'"
    v-model="value"
    :disabled="isDisabled"
  />

  <pdf-attachment-upload
    v-else-if="type === 'pdfUpload'"
    v-model="value"
  />

  <entity-selector
    v-else-if="type === 'selector'"
    v-model="value"
    :selector-key="field.selector"
    :disabled="isDisabled"
    :placeholder="field.placeholder"
    :request-params="typeof field.requestParams === 'function' ? field.requestParams(model) : (field.requestParams || {})"
    @select="onSelectorSelect"
  />

  <region-cascader v-else-if="type === 'region'" v-model="value" />

  <dept-tree-select
    v-else-if="type === 'deptTree'"
    v-model="value"
    :multiple="!!field.multiple"
    @change="onDeptChange"
  />

  <!-- 兜底：配置里写错了 type 时不至于整页白屏 -->
  <el-input v-else v-model="value" :placeholder="placeholder" :disabled="isDisabled" clearable />
</template>

<script setup>
import { computed } from 'vue'
import RegionCascader from './RegionCascader.vue'
import DeptTreeSelect from './DeptTreeSelect.vue'
import EntitySelector from './EntitySelector.vue'
import ProductImageUpload from './ProductImageUpload.vue'
import AvatarUpload from './AvatarUpload.vue'
import PdfAttachmentUpload from './PdfAttachmentUpload.vue'
import ProductItemEditor from './ProductItemEditor.vue'
import InvoicePaymentEditor from './InvoicePaymentEditor.vue'

const props = defineProps({
  /** 字段配置，见各页面的 form-config.js */
  field: { type: Object, required: true },
  /** 表单对象（reactive），字段直接读写它 */
  model: { type: Object, required: true }
})

const type = computed(() => props.field.type || 'input')

/**
 * 配置项允许写成函数，按当前表单值动态求值
 * （角色的「自定义数据范围」只在 dataScope 选了「自定义」时才显示，就靠这个）
 *
 * `options` 走同一套：传函数就能让下拉选项来自接口
 * （产品表单的「单位」传的是 `() => unitOptions.value`，见 composables/useUnitOptions.js）
 */
const resolve = (v) => (typeof v === 'function' ? v(props.model) : v)

const isDisabled = computed(() => !!resolve(props.field.disabled))

const placeholder = computed(
  () => props.field.placeholder ?? `请输入${props.field.label || ''}`
)

const value = computed({
  get: () => props.model[props.field.prop],
  set: (v) => {
    props.model[props.field.prop] = v
  }
})

const displayValue = computed(() => {
  const raw = props.model[props.field.prop]
  if (raw === null || raw === undefined || raw === '') return '--'
  return props.field.format ? props.field.format(raw, props.model) : raw
})

/**
 * statusTag 的颜色
 *
 * field.tagType 支持两种写法：
 *   · 映射对象：{ 报价中: 'warning', 已生成合同: 'success' }（常用，直接复用列表那份）
 *   · 函数：(当前值) => 'warning'
 *
 * ⚠️ 这里**不能**用上面的 resolve()：resolve 是「配置求值器」，会把函数拿 model 调用，
 *    而 tagType 的函数签名要的是**当前字段值**，两者混用会拿到错的东西。
 */
const tagType = computed(() => {
  const conf = props.field.tagType
  const raw = props.model[props.field.prop]
  if (typeof conf === 'function') return conf(raw) || 'info'
  return (conf && conf[raw]) || props.field.fallbackTagType || 'info'
})

/**
 * 部门选中后把名称也写回去
 *
 * 列表上显示的是 deptName 而不是 deptId，只存 id 的话新增行会是一片「--」。
 */
function onDeptChange(node) {
  const extraProp = props.field.extraProp
  if (extraProp) props.model[extraProp] = node?.name ?? ''
}

function onChange() {
  if (typeof props.field.onChange === 'function') {
    props.field.onChange(props.model, props.model[props.field.prop])
  }
}

/**
 * 选择器选中后写回关联字段
 *
 * 1. `extraProp`：把 id 写进另一个字段。字段口径现在用的是**名称**
 *    （ownerName / customerName），列表列显示的就是它；但真实接口最终要的是 id
 *    （ownerUserId / customerId）。两个都留着，下一轮字段对齐时直接改用 id 那份。
 *
 * 2. `onSelect(model, row)`：想把选中行里的**别的东西**写进模型时用。
 *    合同的「报价单编号」就是个例子 —— 输入框里显示报价单名称给人看，
 *    但列表列要的是编号，得从选中行里取 quotationNo。
 *    它在 update:modelValue 之后执行（EntitySelector 先 emit 值再 emit select），
 *    所以会覆盖掉默认写入的名称。
 */
function onSelectorSelect(payload) {
  const { extraProp, onSelect } = props.field

  if (typeof onSelect === 'function') onSelect(props.model, payload)

  if (!extraProp) return
  props.model[extraProp] = Array.isArray(payload)
    ? payload.map((r) => r.id)
    : (payload?.id ?? null)
}
</script>

<style scoped lang="scss">
.form-field__readonly {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  color: var(--crm-text-primary);
}

.form-field__number {
  width: 100%;
}

.form-field__section {
  padding-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--crm-text-primary);
  border-bottom: 1px solid var(--crm-border);
}
</style>
