<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei',
    'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #303133;
  background-color: #f5f7fa;
  -webkit-font-smoothing: antialiased;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background-color: #c0c4cc;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #909399;
}
::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
