<template>
  <!--
    登录

    原型上这一页做得最扎实（《01-原型梳理》第 8 节第 5 点）：
    密码登录 / 验证码登录双模式、注册账号、忘记密码、60 秒倒计时、
    手机号必须是 11 位数字才启用「获取验证码」。这里按同样的结构实现。
  -->
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>AurumCRM</h1>
        <p>企业级智能客户关系管理系统</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs" stretch>
        <!-- ------------------------------ 密码登录 ------------------------------ -->
        <el-tab-pane label="密码登录" name="password">
          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            :validate-on-rule-change="false"
            size="large"
            @keyup.enter="onPasswordLogin"
          >
            <!--
              autocomplete 是刻意标的（不是可省略的样板）：
              登录框标 `username` / `current-password`，注册弹窗标 `new-password` ——
              两边都标清楚，浏览器才不会把「注册」当成「登录」来填，反之亦然。
              详见 RegisterDialog 里的说明。
            -->
            <el-form-item prop="username">
              <el-input
                v-model="passwordForm.username"
                placeholder="请输入账号"
                :prefix-icon="User"
                autocomplete="username"
                clearable
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="passwordForm.password"
                type="password"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                autocomplete="current-password"
                show-password
              />
            </el-form-item>

            <!-- 算术验证码：开关关闭时后端返回 enabled=false，这一行整体不渲染 -->
            <el-form-item v-if="captchaEnabled" prop="captchaCode">
              <div class="login-code-row">
                <el-input
                  v-model="passwordForm.captchaCode"
                  placeholder="请输入计算结果"
                  maxlength="3"
                  autocomplete="off"
                />
                <span class="captcha-question" title="点击换一题" @click="loadCaptcha">
                  {{ captchaQuestion }}
                </span>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="loading"
                style="width: 100%"
                @click="onPasswordLogin"
              >
                {{ loading ? '登录中…' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- ------------------------------ 邮箱验证码登录 ------------------------------ -->
        <el-tab-pane label="邮箱验证码登录" name="email">
          <el-form
            ref="emailFormRef"
            :model="emailForm"
            :rules="emailRules"
            size="large"
            @keyup.enter="onEmailLogin"
          >
            <el-form-item prop="email">
              <el-input
                v-model="emailForm.email"
                placeholder="请输入邮箱"
                :prefix-icon="Message"
                maxlength="128"
                autocomplete="off"
                clearable
              />
            </el-form-item>

            <el-form-item prop="emailCode">
              <div class="login-code-row">
                <el-input
                  v-model="emailForm.emailCode"
                  placeholder="请输入验证码"
                  maxlength="6"
                  autocomplete="off"
                />
                <el-button
                  :disabled="!canSend(emailForm.email)"
                  :loading="sending"
                  @click="send(emailForm.email)"
                >
                  {{ buttonText(emailForm.email) }}
                </el-button>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="loading"
                style="width: 100%"
                @click="onEmailLogin"
              >
                {{ loading ? '登录中…' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="login-links">
        <el-button link type="primary" @click="registerVisible = true">注册账号</el-button>
        <el-divider direction="vertical" />
        <el-button link type="primary" @click="forgotVisible = true">忘记密码</el-button>
      </div>

      <!-- 只在 mock 模式下提示。⚠️ 必须加 v-if：VITE_APP_USE_MOCK 已改为 false，
           无条件渲染的话会一直显示「后端尚未实现」这个已经过时的说明 -->
      <div v-if="isMock" class="login-tips">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="MOCK 模式"
        >
          后端 <code>/auth/*</code> 尚未实现，登录走本地 mock：账号密码随便填，
          邮箱验证码固定为 <code>123456</code>（也会打到浏览器控制台）。
        </el-alert>
      </div>
    </div>

    <register-dialog v-model="registerVisible" @success="onRegisterSuccess" />
    <forgot-password-dialog v-model="forgotVisible" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Message } from '@element-plus/icons-vue'
import RegisterDialog from './components/RegisterDialog.vue'
import ForgotPasswordDialog from './components/ForgotPasswordDialog.vue'
import { getCaptcha } from '@/api/auth'
import { useUserStore } from '@/store/user'
import { useEmailCountdown, isValidEmail } from '@/composables/useEmailCountdown'
import settings from '@/settings'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('password')
const loading = ref(false)

/** 是否处于 mock 模式（决定要不要显示顶部那条 mock 说明） */
const isMock = import.meta.env.VITE_APP_USE_MOCK === 'true'

const registerVisible = ref(false)
const forgotVisible = ref(false)

/**
 * 邮箱验证码倒计时。
 *
 * 倒计时状态在 composable 内部**按邮箱**共享（注册 / 登录 / 找回密码三个入口共用一份），
 * 所以这里不需要再手动清理定时器 —— 它会在没有活跃倒计时时自己收掉。
 * 详见 composables/useEmailCountdown.js 顶部的说明。
 */
const { sending, buttonText, canSend, send } = useEmailCountdown()

// —— 密码登录 ——
const passwordFormRef = ref(null)
// captchaKey / captchaCode 会被 userStore.login() 原样带进 POST /auth/login 的请求体
const passwordForm = reactive({ username: '', password: '', captchaKey: '', captchaCode: '' })

// —— 算术验证码 ——
//
// ⚠️ 初始值必须是 false，不能是 true：否则首帧会渲染一个空的题目行，
//    要等 onMounted 拿到结果才显示。
const captchaEnabled = ref(false)
const captchaQuestion = ref('')

/**
 * 换一道新题。
 *
 * 换题时必须清空输入框 —— 旧题已经作废，留着上次的答案只会让用户以为填对了。
 */
async function loadCaptcha() {
  try {
    const data = await getCaptcha()
    captchaEnabled.value = !!data?.enabled
    captchaQuestion.value = data?.captchaQuestion || ''
    passwordForm.captchaKey = data?.captchaKey || ''
    passwordForm.captchaCode = ''
  } catch (e) {
    // 取题失败不再额外弹提示（request.js 已统一提示过）。
    // 先把这一行藏起来；若服务端开关其实是开的，提交时会拿到 1008 的准确提示。
    captchaEnabled.value = false
    console.warn('[算术验证码] 获取失败', e.message)
  }
}

// 验证码规则只在开关开启时挂上 —— 关掉验证码时表单不该再要求填它
//
// ⚠️ 因为这是个 computed，onMounted 拉到验证码后它会返回**新对象**，
//    而 el-form 对 rules 是 `deep: true` 的 watch，且 validate-on-rule-change
//    默认为 true —— 那个 watch 会立刻对整个表单做一次 validate()。
//    结果就是「刚进登录页、什么都没填，三个输入框已经全部标红」。
//    所以上面的 el-form 必须显式写 :validate-on-rule-change="false"。
const passwordRules = computed(() => ({
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 2, max: 32, message: '账号长度为 2 到 32 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为 6 到 20 个字符', trigger: 'blur' }
  ],
  ...(captchaEnabled.value
    ? {
        captchaCode: [
          { required: true, message: '请输入计算结果', trigger: 'blur' },
          // 答案是整数，可能是 0（如「5 - 5 = ?」），最大 100（10 × 10）
          { pattern: /^\d{1,3}$/, message: '请输入数字结果', trigger: 'blur' }
        ]
      }
    : {})
}))

onMounted(loadCaptcha)

// —— 邮箱验证码登录 ——
const emailFormRef = ref(null)
const emailForm = reactive({ email: '', emailCode: '' })

const emailRule = {
  validator: (rule, value, callback) =>
    isValidEmail(value) ? callback() : callback(new Error('请输入正确的邮箱地址')),
  trigger: 'blur'
}

const emailRules = {
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, emailRule],
  emailCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为 6 位', trigger: 'blur' }
  ]
}

/**
 * 登录成功后的收尾
 *
 * 错误提示由 request.js 的响应拦截器统一处理，这里不重复弹。
 */
async function doLogin(action, formRef) {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await action()
    ElMessage.success('登录成功')
    // 支持登录后跳回原页面
    const redirect = route.query.redirect
    await router.push(redirect ? decodeURIComponent(redirect) : settings.homePath)
  } catch (e) {
    console.warn('[登录失败]', e.message)
    // 失败就把验证码换掉。两个理由：
    //   ① 后端是「答错即作废」——这张图已经被消费掉了，不换的话用户对着废图怎么填都不对
    //   ② 即便是账号密码错，用户重新提交时本来也要重填
    loadCaptcha()
  } finally {
    loading.value = false
  }
}

function onPasswordLogin() {
  return doLogin(() => userStore.login(passwordForm), passwordFormRef)
}

function onEmailLogin() {
  return doLogin(() => userStore.loginByEmail(emailForm), emailFormRef)
}

/**
 * 注册成功后把账号回填到密码登录框
 *
 * ⚠️ **不切到密码登录 Tab**：注册出来的账号是禁用状态，现在登不进去（见
 * `api/auth.js` 的 register 注释）。刚提示完「暂时不能登录」就跳到一个登录表单，
 * 用户下一步必然去点登录然后被拒 —— 徒增困惑。回填只是备着，以后用得上。
 */
function onRegisterSuccess(username) {
  passwordForm.username = username
}
</script>

<style scoped lang="scss">
.login-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f3a5f 0%, #2b5b8c 50%, #3a7ca5 100%);
}

.login-box {
  width: 400px;
  padding: 32px 36px 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.login-header {
  text-align: center;
  margin-bottom: 16px;

  h1 {
    margin: 0 0 8px;
    font-size: 26px;
    font-weight: 600;
    color: #1f3a5f;
    letter-spacing: 1px;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #909399;
  }
}

.login-tabs {
  :deep(.el-tabs__item) {
    font-size: 15px;
  }
}

.login-code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

// 算术验证码的题目文本。宽度与 el-input 的高度对齐，视觉上像同一行的两个控件
.captcha-question {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;        // 别被 flex 压扁
  min-width: 100px;
  height: 40px;
  padding: 0 10px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  white-space: nowrap;
  cursor: pointer;       // 提示可点击换一题
  user-select: none;     // 别让用户选中题目文本，免得像可复制的内容
}

.login-links {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.login-tips {
  :deep(.el-alert__title) {
    font-size: 12px;
    line-height: 1.6;
  }

  code {
    background: #f0f2f5;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 12px;
  }
}
</style>
