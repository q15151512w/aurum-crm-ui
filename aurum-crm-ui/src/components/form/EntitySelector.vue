<template>
  <!--
    选择器控件（放在 el-form-item 里用的那个「输入框」）

    看着像个只读输入框，点一下弹 EntitySelectorDialog。
    modelValue 是**显示用的文字**（如负责人姓名），不是 id ——
    因为列表列显示的就是姓名（字段口径决策，见遗留清单）。

    需要 id 的场景（如真的要提交 ownerUserId）由 field.extraProp 接收，
    见 FormField.vue 的 onSelectorSelect。
  -->
  <div class="entity-selector">
    <el-input
      :model-value="modelValue"
      readonly
      :disabled="disabled"
      :placeholder="placeholder || `请选择${config?.title?.replace('选择', '') || ''}`"
      @click="open"
    >
      <template #suffix>
        <!-- 有值时可一键清空；没值就只是个放大镜提示可点 -->
        <el-icon
          v-if="modelValue && !disabled"
          class="entity-selector__clear"
          @click.stop="clear"
        >
          <CircleClose />
        </el-icon>
        <el-icon v-else><Search /></el-icon>
      </template>
    </el-input>

    <entity-selector-dialog
      v-model="visible"
      :selector-key="selectorKey"
      :request-params="requestParams"
      @confirm="onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, CircleClose } from '@element-plus/icons-vue'
import EntitySelectorDialog from './EntitySelectorDialog.vue'
import { getSelectorConfig, selectorLabel } from '@/constants/selectorRegistry'

const props = defineProps({
  /** 显示文字，如 '李传锋'；多选时是 '张三，李四' */
  modelValue: { type: String, default: '' },
  /** 注册表 key，见 constants/selectorRegistry.js */
  selectorKey: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  requestParams: { type: Object, default: () => ({}) }
})

/** select 传出选中的行：单选给对象（或 null），多选给数组 */
const emit = defineEmits(['update:modelValue', 'select'])

const visible = ref(false)

const config = computed(() => getSelectorConfig(props.selectorKey))

/** 单选还是多选由注册表说了算，不在这里再传一遍，免得两处不一致 */
const isMultiple = computed(() => !!config.value?.multiple)

function open() {
  if (props.disabled) return
  visible.value = true
}

function onConfirm(rows) {
  emit('update:modelValue', rows.map(selectorLabel).filter(Boolean).join('，'))
  emit('select', isMultiple.value ? rows : rows[0])
}

function clear() {
  emit('update:modelValue', '')
  emit('select', isMultiple.value ? [] : null)
}
</script>

<style scoped lang="scss">
.entity-selector {
  width: 100%;
}

.entity-selector__clear {
  cursor: pointer;

  &:hover {
    color: var(--crm-primary);
  }
}
</style>
