<template>
  <!--
    组织架构

    这一页原型上不是列表，是一棵部门树：集团 → 部门 → 小组 三级。
    节点右侧的操作按钮 hover 才出现（原型上也是悬停显示）。
  -->
  <div class="dept-page">
    <div class="dept-page__head">
      <h2 class="dept-page__title">组织架构</h2>
      <el-button type="primary" size="large" @click="onAdd(null)">新增部门</el-button>
    </div>

    <!-- 图例：三种节点类型在原型上是三种底色 -->
    <div class="dept-legend">
      <span class="dept-legend__title">图例：</span>
      <i
        v-for="item in LEGEND"
        :key="item.type"
        class="dept-badge"
        :class="`dept-badge--${item.type}`"
      >
        {{ item.label }}
      </i>
    </div>

    <el-card v-loading="loading" shadow="never" class="dept-card">
      <el-tree
        :data="tree"
        node-key="id"
        default-expand-all
        :expand-on-click-node="false"
        :props="{ label: 'name', children: 'children' }"
      >
        <template #default="{ data }">
          <div class="dept-node">
            <i class="dept-badge" :class="`dept-badge--${data.type}`">{{ typeLabel(data.type) }}</i>
            <span class="dept-node__name">{{ data.name }}</span>
            <span class="dept-node__leader">负责人：{{ data.leaderName || '--' }}</span>

            <!-- 悬停才出现，避免树上挂满按钮 -->
            <span class="dept-node__actions">
              <el-button link type="primary" size="small" @click.stop="onAdd(data)">新增部门</el-button>
              <el-button link type="primary" size="small" @click.stop="onEdit(data)">编辑</el-button>
              <el-button link type="primary" size="small" @click.stop="onSetLeader(data)">设置负责人</el-button>
              <el-button link type="danger" size="small" @click.stop="onDelete(data)">删除</el-button>
            </span>
          </div>
        </template>
      </el-tree>

      <el-empty v-if="!loading && !tree.length" description="暂无部门数据" />
    </el-card>

    <config-form-dialog
      v-model="visible"
      :title="title"
      :fields="FIELDS"
      :model="form"
      :submitting="submitting"
      width="560px"
      @submit="submit"
    />

    <!-- 设置负责人：原型上就是弹「选择人员」，这里复用通用选择器 -->
    <entity-selector-dialog
      v-model="leaderVisible"
      selector-key="deptLeader"
      @confirm="onLeaderConfirm"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import EntitySelectorDialog from '@/components/form/EntitySelectorDialog.vue'
import {
  getDeptTree,
  deleteDept,
  setDeptLeader,
  createDept,
  updateDept
} from '@/api/system'
import { useFormDialog } from '@/composables/useFormDialog'
import { DEPT_TYPE_OPTIONS } from '@/constants/options'

/** 节点类型 → 文案，与图例、节点上的色块一一对应 */
const TYPE_LABEL = { group: '集团', dept: '行政部门', team: '部门小组' }
const LEGEND = Object.entries(TYPE_LABEL).map(([type, label]) => ({ type, label }))

const loading = ref(false)
const tree = ref([])

const typeLabel = (type) => TYPE_LABEL[type] || '部门'

async function load() {
  loading.value = true
  try {
    const data = await getDeptTree()
    tree.value = Array.isArray(data) ? data : data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)

/**
 * 表单字段
 *
 * 父部门用 deptTree 选择器。新增时从树上某个节点的「新增部门」进来，
 * 会把 parentId 预填成那个节点，不用再选一次。
 */
const FIELDS = [
  { prop: 'parentId', label: '上级部门', type: 'deptTree' },
  {
    prop: 'name',
    label: '部门名称',
    type: 'input',
    required: true,
    maxlength: 64
  },
  { prop: 'type', label: '部门类型', type: 'select', options: DEPT_TYPE_OPTIONS, required: true },
  {
    prop: 'leaderName',
    label: '部门负责人',
    type: 'selector',
    selector: 'deptLeader',
    extraProp: 'leaderUserId'
  }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '部门',
  emptyForm: () => ({ parentId: 0, name: '', type: 'dept', leaderName: '', leaderUserId: null }),
  create: createDept,
  update: updateDept,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    load()
  }
})

/** 新增挂在当前节点下（不传则是顶级） */
function onAdd(row) {
  openAdd(row ? { parentId: row.id } : {})
}

/**
 * 编辑
 *
 * ⚠️ 必须先把 children 摘掉再进表单：部门是树，节点带着整棵子树，
 *    不摘的话 deepClone 会把子孙节点一起复制进表单模型，提交时全发给后端。
 */
function onEdit(row) {
  const { children, ...rest } = row
  openEdit(rest)
}

// —— 设置负责人 ——
const leaderVisible = ref(false)
const leaderTarget = ref(null)

function onSetLeader(row) {
  leaderTarget.value = row
  leaderVisible.value = true
}

async function onLeaderConfirm(rows) {
  const leader = rows[0]
  await setDeptLeader(leaderTarget.value.id, leader.id)
  ElMessage.success(`已把「${leader.name}」设为「${leaderTarget.value.name}」的负责人`)
  load()
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除部门「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await deleteDept(row.id)
  ElMessage.success('删除成功')
  load()
}

</script>

<style scoped lang="scss">
.dept-page__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dept-page__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.dept-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;

  &__title {
    font-size: 14px;
    color: var(--crm-text-secondary);
  }
}

/* 三种节点底色：集团是蓝色胶囊，行政部门黄绿块，小组绿块 */
.dept-badge {
  display: inline-block;
  height: 22px;
  line-height: 22px;
  padding: 0 10px;
  font-size: 12px;
  font-style: normal;
  white-space: nowrap;

  &--group {
    background-color: #e6f4ff;
    color: #2c6ddb;
    border-radius: 11px;
  }

  &--dept {
    background-color: #eef7d9;
    color: #5b8c00;
    border-radius: 4px;
  }

  &--team {
    background-color: #e4f5e8;
    color: #2d9b45;
    border-radius: 4px;
  }
}

.dept-card {
  :deep(.el-tree-node__content) {
    height: 44px;
  }
}

.dept-node {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding-right: 8px;

  &__name {
    font-size: 14px;
    color: var(--crm-text-primary);
  }

  &__leader {
    font-size: 13px;
    color: var(--crm-text-secondary);
  }

  &__actions {
    margin-left: auto;
    visibility: hidden;
  }

  &:hover .dept-node__actions {
    visibility: visible;
  }
}
</style>
