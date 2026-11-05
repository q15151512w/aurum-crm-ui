<template>
  <!--
    列表页批量操作栏（对应原型表格上方「已选 1 项 编辑 删除 放入公海」那一条）

    原型上这行恒定可见（那是静态稿）。真实交互里一件没选中时按钮点了也没意义，
    所以这里保留整行的可见性，但把按钮置灰 —— 既贴合原型的视觉，
    又不会让用户点了没反应。

    权限：action 上带 `perm` 的按钮会按当前登录用户的权限点过滤掉（见下方 visibleActions）。
    没写 perm 的按钮一律保留，所以漏配不会导致按钮集体消失。
  -->
  <div class="list-toolbar">
    <span class="list-toolbar__count">已选 {{ count }} 项</span>

    <el-button
      v-for="action in visibleActions"
      :key="action.key"
      :type="action.type"
      :disabled="count === 0 || action.disabled"
      :icon="action.icon"
      @click="emit('action', action.key)"
    >
      {{ action.label }}
    </el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store/user'

const props = defineProps({
  count: { type: Number, default: 0 },
  /** [{ key, label, type?, icon?, disabled?, perm? }] */
  actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['action'])

const userStore = useUserStore()

/**
 * 按权限点过滤。
 *
 * ⚠️ 这里过滤掉按钮**不等于**后端放行 —— 后端有 `@SaCheckPermission` 兜底
 *    （见后端 docs/07 的 BUG-016）。这里只是别让用户看见一个点了必然 403 的按钮。
 * ⚠️ `perm` 缺省 = 不做限制（`hasPermission` 对空值返回 true），保持向后兼容。
 */
const visibleActions = computed(() =>
  props.actions.filter((action) => userStore.hasPermission(action.perm))
)
</script>

<style scoped lang="scss">
.list-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.list-toolbar__count {
  font-size: 14px;
  color: var(--crm-text-primary);
  margin-right: 12px;
  white-space: nowrap;
}
</style>
