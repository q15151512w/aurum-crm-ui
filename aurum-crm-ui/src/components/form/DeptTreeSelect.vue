<template>
  <!--
    部门选择（组织架构树）

    部门是自关联树，用 el-tree-select 而不是普通下拉。
    选中后除了回写 id，还会把整个节点 emit 出去 —— 因为列表上显示的是部门**名称**，
    表单得能同时拿到 name 去填 deptName 之类的展示字段。
  -->
  <el-tree-select
    :model-value="modelValue"
    :data="tree"
    :props="treeProps"
    node-key="id"
    :loading="loading"
    :render-after-expand="false"
    :placeholder="multiple ? '请选择部门（可多选）' : '请选择部门'"
    :multiple="multiple"
    :show-checkbox="multiple"
    check-strictly
    clearable
    filterable
    default-expand-all
    @update:model-value="onChange"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDeptTree } from '@/api/system'
import { findTreeNode } from '@/utils/tree'

const props = defineProps({
  /** 部门 id；多选时是 id 数组 */
  modelValue: { type: [Number, String, Array], default: null },
  /** 多选（角色表单的「自定义数据范围」要一次选多个部门） */
  multiple: { type: Boolean, default: false }
})

/** update:modelValue 给 id，change 给整个节点（拿 name 用） */
const emit = defineEmits(['update:modelValue', 'change'])

/** 后端返回的字段是 name，不是 el-tree 默认的 label */
const treeProps = { label: 'name', children: 'children' }

const tree = ref([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    tree.value = (await getDeptTree()) || []
  } catch {
    // 失败提示已由 request.js 统一处理
    tree.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 多选时 id 是数组，节点信息用不上（extraProp 只在单选场景有意义），
 * 所以只在单选时把节点 emit 出去。
 */
function onChange(id) {
  if (props.multiple) {
    emit('update:modelValue', Array.isArray(id) ? id : [])
    return
  }
  emit('update:modelValue', id ?? null)
  emit('change', id == null ? null : findTreeNode(tree.value, id))
}

onMounted(load)
</script>
