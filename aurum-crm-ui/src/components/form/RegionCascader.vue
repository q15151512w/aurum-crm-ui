<template>
  <!--
    省市区三级联动

    这是个「字符串进、字符串出」的控件：外部（表单模型 / 列表行）存的是
    '广东省广州市天河区' 这种拼接串，组件内部转成级联选择器要的三级数组。
    转换逻辑在 constants/regions.js，数据源就绪后换那一份即可。
  -->
  <div class="region-cascader">
    <el-cascader
      :model-value="path"
      :options="REGION_OPTIONS"
      :props="cascaderProps"
      placeholder="请选择省 / 市 / 区"
      clearable
      filterable
      @update:model-value="onChange"
    />

    <!--
      原值解析不出来时的提示
      mock 里有 '江苏省苏州市工业园区' 这类非标准行政区划。不能静默丢掉 ——
      用户很可能只是来改个别的字段，一保存地区就没了。这里明确告诉他原值还在。
    -->
    <div v-if="unparsed" class="region-cascader__tip">
      原值「{{ modelValue }}」不在可选范围内，未改动则保持原值
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { REGION_OPTIONS, parseRegion, regionToText } from '@/constants/regions'

const props = defineProps({
  /** 拼接串，如 '广东省广州市天河区' */
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

/** 只允许选到区县一级 */
const cascaderProps = { expandTrigger: 'hover' }

const path = computed(() => parseRegion(props.modelValue))

/** 有值但解析不出来 —— 数据源里没有这个地区 */
const unparsed = computed(() => !!props.modelValue && path.value.length === 0)

function onChange(value) {
  emit('update:modelValue', regionToText(value))
}
</script>

<style scoped lang="scss">
.region-cascader {
  width: 100%;
}

.region-cascader__tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--crm-text-secondary);
}
</style>
