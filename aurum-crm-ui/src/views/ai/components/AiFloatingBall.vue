<template>
  <!--
    全局悬浮球：所有登录后的页面都在（挂在 layout 里，只挂一份）。

    点击开合右侧的聊天面板 —— 与顶栏入口、首页快捷入口操作的是同一个 store，
    三处任何一处打开，另外两处看到的都是同一个对话。
  -->
  <div
    class="ai-ball"
    :class="{ 'is-open': aiStore.visible, 'is-dragging': dragging }"
    :style="ballStyle"
    :title="aiStore.visible ? '收起 AI 小助手' : '打开 AI 小助手'"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <el-icon :size="20">
      <Close v-if="aiStore.visible" />
      <MagicStick v-else />
    </el-icon>
    <span v-if="!aiStore.visible" class="ai-ball__label">AI</span>
    <!-- 生成中显示一个小圆点，收起面板时也能知道回答还在继续 -->
    <span v-if="aiStore.streaming" class="ai-ball__dot" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { MagicStick, Close } from '@element-plus/icons-vue'
import { useAiStore } from '@/store/ai'

const aiStore = useAiStore()

// ---------- 桌面宠物式拖拽：全屏自由拖动，松手停在原地 ----------
const EDGE_GAP = 12
// 位置永远用 left/top 表达（不混用 right/bottom），拖起来平滑无跳变
const pos = ref(null) // { left, top }，null = 尚未定位到右下角
const dragging = ref(false)
const moved = ref(false)

const BALL_WIDTH = 96 // 胶囊常态近似宽，用于把默认位置放到右下角
const BALL_HEIGHT = 48

// 首次加载把初始位置放到右下角（跟原来的 bottom:32/right:32 视觉一致）
function initPosition() {
  if (pos.value) return
  pos.value = {
    left: window.innerWidth - BALL_WIDTH - 32,
    top: window.innerHeight - BALL_HEIGHT - 32
  }
}
onMounted(initPosition)

// 窗口尺寸变化时，若已拖到屏幕外，把它拉回可视区
function clampToViewport() {
  if (!pos.value) return
  pos.value.left = clamp(pos.value.left, EDGE_GAP, window.innerWidth - BALL_WIDTH - EDGE_GAP)
  pos.value.top = clamp(pos.value.top, EDGE_GAP, window.innerHeight - BALL_HEIGHT - EDGE_GAP)
}
window.addEventListener('resize', clampToViewport)

const ballStyle = computed(() =>
  pos.value ? { left: `${pos.value.left}px`, top: `${pos.value.top}px` } : {}
)

function onPointerDown(e) {
  if (e.button !== 0) return
  const ball = e.currentTarget
  const rect = ball.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  const startLeft = rect.left
  const startTop = rect.top

  dragging.value = true
  moved.value = false

  const onMove = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.value = true
    const left = clamp(startLeft + dx, EDGE_GAP, window.innerWidth - rect.width - EDGE_GAP)
    const top = clamp(startTop + dy, EDGE_GAP, window.innerHeight - rect.height - EDGE_GAP)
    pos.value = { left, top }
  }

  const onUp = () => {
    dragging.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onClick() {
  // 位移了就当拖动，不再开关面板
  if (moved.value) return
  aiStore.toggle()
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), Math.max(min, max))
}
</script>

<style scoped lang="scss">
.ai-ball {
  position: fixed;
  // 高于内容区，但不能盖住表单弹窗（Element Plus 的弹窗在 2000+）
  z-index: 1990;
  height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  cursor: grab;
  background: linear-gradient(135deg, #7c4dff, #2c6ddb);
  box-shadow: 0 6px 18px rgba(44, 109, 219, 0.35);
  transition: box-shadow 0.2s, padding 0.2s;
  user-select: none;
  touch-action: none;

  &.is-dragging {
    cursor: grabbing;
    box-shadow: 0 12px 26px rgba(44, 109, 219, 0.5);
  }

  &.is-open {
    width: 48px;
    padding: 0;
    justify-content: center;
    background: #909399;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  }
}

.ai-ball__label {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1;
  user-select: none;
}

.ai-ball__dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #67c23a;
  border: 2px solid #fff;
  // 生成中的呼吸效果，暗示「还在跑」
  animation: ai-ball-pulse 1.2s ease-in-out infinite;
}

@keyframes ai-ball-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}
</style>
