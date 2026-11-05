<template>
  <!-- 操作日志：同登陆日志，纯查询页 -->
  <pro-list
    ref="listRef"
    title="操作日志"
    :fetcher="getOperationLogPage"
    :columns="columns"
    :filters="[]"
    :toolbar="[]"
    :selectable="false"
    :starrable="false"
    search-placeholder="操作人/模块"
  >
    <!-- 成功绿、失败红 -->
    <template #cell-status="{ value }">
      <el-tag :type="value === '成功' ? 'success' : 'danger'" effect="plain" size="small">
        {{ value }}
      </el-tag>
    </template>
  </pro-list>
</template>

<script setup>
import { ref } from 'vue'
import ProList from '@/components/ProList.vue'
import { getOperationLogPage } from '@/api/system'

const listRef = ref(null)

/** prop 与 mock/db.js 的 operationLog 一致 */
const columns = [
  { prop: 'userName', label: '操作人', minWidth: 110 },
  { prop: 'module', label: '模块', minWidth: 100 },
  { prop: 'action', label: '操作', minWidth: 90 },
  { prop: 'method', label: '方法', minWidth: 260 },
  { prop: 'params', label: '请求参数', minWidth: 200 },
  { prop: 'ip', label: 'IP地址', minWidth: 140 },
  { prop: 'costMs', label: '耗时(ms)', minWidth: 100 },
  { prop: 'status', label: '状态', minWidth: 100 },
  { prop: 'operateTime', label: '操作时间', minWidth: 150 }
]
</script>
