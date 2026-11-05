import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { permission } from '@/directives/permission'

import 'element-plus/dist/index.css'
import '@/styles/index.scss'
// 必须放在 element-plus 的样式之后 —— 组件规格覆写要压过默认样式
import '@/styles/element.scss'

const app = createApp(App)

// 全局注册 Element Plus 图标
// （组件本身由 unplugin-vue-components 按需引入，但图标是动态使用的，需手动注册）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn }) // 中文语言包：分页、日期选择器等组件的中文显示

// 按钮级权限：v-permission（按权限点隐藏元素，见 directives/permission.js）
// ⚠️ 必须在 createPinia() 之后注册 —— 指令内部要用 userStore，
//    而 store 在组件 setup 里才实例化，指令的 mounted 时机是安全的。
app.directive('permission', permission)

app.mount('#app')

// 挂载完成后移除首屏加载动画（见 index.html）
const loading = document.getElementById('app-loading')
if (loading) loading.remove()
