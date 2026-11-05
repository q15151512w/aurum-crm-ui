<template>
  <!--
    配置驱动的表单弹窗

    16 个「新增 / 编辑」弹窗的骨架完全一样：标题 + 栅格表单 + 取消/确定。
    差异只有「字段配置」和「提交调哪个接口」两件事，所以做成配置驱动，
    业务页面只写一份 fields 配置 + 一个 useFormDialog。

    用法见 views/system/unit/index.vue。
  -->
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleOpen"
  >
    <el-form
      ref="formRef"
      :model="model"
      :rules="rules"
      :label-width="labelWidth"
      @submit.prevent
    >
      <el-row :gutter="16">
        <el-col v-for="f in visibleFields" :key="f.prop" :span="f.span ?? 12">
          <el-form-item :label="f.label" :prop="f.prop">
            <form-field :field="f" :model="model" />
            <div v-if="f.tip" class="config-form__tip">{{ f.tip }}</div>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <!--
      底部按钮：默认「取消 + 确定」，页面可通过 #footer 覆写。
      发票登记要「取消 / 保存草稿 / 提交审核」三个按钮 —— 它必须自己控制按钮
      才能区分两种提交语义，所以这里必须让出插槽，把「要不要校验、校验完干嘛」
      通过 defineExpose 的 validate() 交给页面。
    -->
    <template #footer>
      <slot name="footer" :validate="validate" :submitting="submitting" :close="close">
        <div class="dialog-footer">
          <el-button @click="close">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
        </div>
      </slot>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import FormField from './FormField.vue'

const props = defineProps({
  /** 弹窗开关，配合 useFormDialog 的 visible */
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  /** 字段配置数组 */
  fields: { type: Array, default: () => [] },
  /** 表单对象（reactive） */
  model: { type: Object, required: true },
  submitting: { type: Boolean, default: false },
  width: { type: String, default: '640px' },
  labelWidth: { type: String, default: '96px' }
})

const emit = defineEmits(['update:modelValue', 'submit'])

const formRef = ref(null)

/** 会「选择」而不是「输入」的控件，校验文案与触发时机都不一样 */
const PICKER_TYPES = ['select', 'radio', 'date', 'datetime', 'region', 'deptTree', 'selector', 'pdfUpload']

const resolve = (v) => (typeof v === 'function' ? v(props.model) : v)

/**
 * 条件显隐
 *
 * 隐藏的字段不渲染 → el-form 不会校验它，这正是想要的行为：
 * 角色表单没选「自定义」数据范围时，部门树不该拦着提交。
 */
const visibleFields = computed(() =>
  props.fields.filter((f) => f.visible === undefined || resolve(f.visible))
)

/**
 * 由字段配置推导校验规则
 *
 * 只写 required: true 就能得到一条合理的校验；要更细的规则时给 field.rules。
 *
 * `required` 也可以写成函数：人员表单的密码「新增必填、编辑留空表示不改」
 * 就是靠 `(model) => !model.id` 表达的（编辑时回填的数据带了 id）。
 */
const rules = computed(() => {
  const out = {}
  for (const f of props.fields) {
    const list = []
    if (resolve(f.required)) {
      const verb = PICKER_TYPES.includes(f.type) ? '请选择' : '请输入'
      list.push({
        required: true,
        message: f.requiredMessage || `${verb}${f.label}`,
        trigger: PICKER_TYPES.includes(f.type) ? 'change' : 'blur'
      })
    }
    if (f.rules) list.push(...[].concat(f.rules))
    if (list.length) out[f.prop] = list
  }
  return out
})

/**
 * 每次打开清掉上一次的校验红字
 *
 * 弹窗没有用 destroy-on-close（销毁重建会带来校验状态残留和赋值时序竞争），
 * 所以 DOM 是复用的，必须手动清。
 */
function handleOpen() {
  nextTick(() => formRef.value?.clearValidate())
}

/**
 * 派生字段
 *
 * 配了 `compute` 的字段由其它字段算出来，用户不用手填（界面上配 `disabled: true` 置灰）。
 * 目前用于商机的「整单最终价」、发票的税额/价税合计，以及报价单与合同的明细合计。
 *
 * ⚠️ `compute` 不能依赖它自己要写的那个 prop，否则会自我触发成死循环。
 */
watch(
  () => props.model,
  (model) => {
    for (const f of props.fields) {
      if (typeof f.compute !== 'function') continue
      const next = f.compute(model)
      // 值没变就不写，避免无谓的重复渲染
      if (model[f.prop] !== next) model[f.prop] = next
    }
  },
  { deep: true, immediate: true }
)

function close() {
  emit('update:modelValue', false)
}

/**
 * 校验表单，返回是否通过。
 *
 * 是 `#footer` 插槽与 `defineExpose` 共用的那一个校验入口：发票页要用
 * 「保存草稿」和「提交审核」两个按钮，两者都得先过校验，但校验之后的动作不同 ——
 * 如果页面自己再写一遍 `formRef.validate()`，两条路径的校验规则迟早会漂移。
 */
async function validate() {
  return (await formRef.value?.validate().catch(() => false)) === true
}

async function handleSubmit() {
  if (!(await validate())) return
  emit('submit')
}

defineExpose({ validate, close })
</script>

<style scoped lang="scss">
.config-form__tip {
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--crm-text-secondary);
}
</style>
