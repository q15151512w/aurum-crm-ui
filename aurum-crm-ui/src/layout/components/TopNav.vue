<template>
  <!--
    顶部一级导航（原型 #u3765：1920x56，主色底，白色文字）

    一级导航的 8 项来自菜单树顶层，与左侧二级导航联动（见 composables/useActiveMenu.js）。
  -->
  <header class="top-nav">
    <div class="top-nav__brand">AurumCRM</div>

    <nav class="top-nav__menu">
      <div
        v-for="item in navItems"
        :key="item.menuId ?? item.path"
        class="top-nav__item"
        :class="{ 'is-active': isActive(item) }"
        @click="handleSelect(item)"
      >
        {{ item.menuName }}
      </div>
    </nav>

    <div class="top-nav__right">
      <el-tag v-if="isMock" size="small" effect="plain" class="top-nav__mock">
        MOCK 模式
      </el-tag>

      <!-- 消息铃铛：点开弹出未读消息列表（点击某条弹详情并标记已读，未读数减 1） -->
      <el-popover
        placement="bottom-end"
        :width="340"
        trigger="click"
        @show="onBellOpen"
      >
        <template #reference>
          <el-badge
            :value="unreadCount"
            :max="99"
            :hidden="unreadCount === 0"
            class="top-nav__bell"
          >
            <el-icon :size="18"><Bell /></el-icon>
          </el-badge>
        </template>

        <div class="top-nav__bell-panel">
          <div v-if="loading" v-loading="true" class="top-nav__bell-loading" />
          <template v-else-if="unreadList.length">
            <div class="top-nav__bell-head">
              <span>未读消息</span>
              <el-button link type="primary" size="small" @click="onReadAll">
                全部已读
              </el-button>
            </div>
            <ul class="top-nav__bell-list">
              <li
                v-for="item in unreadList"
                :key="item.id"
                class="top-nav__bell-item"
                @click="onPick(item)"
              >
                <span
                  class="top-nav__bell-tag"
                  :style="{ backgroundColor: tagColor(item.type) }"
                >
                  {{ item.typeName }}
                </span>
                <span class="top-nav__bell-title" :title="item.title">{{
                  item.title
                }}</span>
                <span class="top-nav__bell-time">{{
                  fmtTime(item.sendTime)
                }}</span>
              </li>
            </ul>
            <div class="top-nav__bell-foot">
              <el-button link size="small" @click="goAll">查看全部</el-button>
            </div>
          </template>
          <el-empty v-else description="暂无未读消息" :image-size="60" />
        </div>
      </el-popover>

      <el-dropdown @command="handleCommand">
        <span class="top-nav__user">
          <!-- 没设头像时 el-avatar 会自动退回 UserFilled 图标，不用自己写判断 -->
          <el-avatar
            :size="28"
            :src="userStore.userInfo?.avatar"
            :icon="UserFilled"
          />
          <span class="top-nav__user-name">{{
            userStore.nickName || "未登录"
          }}</span>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              {{ userStore.userInfo?.deptName || "—" }}
            </el-dropdown-item>
            <el-dropdown-item command="profile" divided
              >个人信息</el-dropdown-item
            >
            <el-dropdown-item command="password">修改密码</el-dropdown-item>
            <el-dropdown-item command="logout" divided
              >退出登陆</el-dropdown-item
            >
            <el-dropdown-item disabled>系统版本 v1.0</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <change-password-dialog ref="passwordDialogRef" />

    <!-- 消息详情弹窗（铃铛里点某条后弹出） -->
    <el-dialog
      v-model="detailVisible"
      width="560px"
      append-to-body
      :show-close="false"
      class="notice-detail-dialog"
    >
      <div class="notice-detail">
        <!-- 头部：分类色带 + 图标 + 标题 + 时间 -->
        <div
          class="notice-detail__hero"
          :style="{ '--accent': accent(current?.type) }"
        >
          <div class="notice-detail__icon">
            <el-icon :size="22"><Bell /></el-icon>
          </div>
          <div class="notice-detail__head">
            <div class="notice-detail__tag">
              {{ current?.typeName || "系统通知" }}
            </div>
            <h3 class="notice-detail__title">
              {{ current?.title || "消息详情" }}
            </h3>
          </div>
          <el-button
            text
            bg
            circle
            class="notice-detail__close"
            @click="detailVisible = false"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <!-- 正文 -->
        <div class="notice-detail__body">
          <div class="notice-detail__meta">
            <el-icon class="notice-detail__meta-ico"><Clock /></el-icon>
            <span>{{ fmtTime(current?.sendTime) || "—" }}</span>
          </div>
          <p class="notice-detail__content">
            {{ current?.content || "（无内容）" }}
          </p>
        </div>

        <!-- 底部操作区 -->
        <div class="notice-detail__foot">
          <el-button
            v-if="current?.bizType === 'customer'"
            type="primary"
            round
            class="notice-detail__action"
            @click="goBiz"
          >
            去处理
            <el-icon class="el-icon--right"><Right /></el-icon>
          </el-button>
          <el-button round @click="detailVisible = false">我知道了</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 查看全部消息弹窗（取代跳转到 /system/notice 页面） -->
    <el-dialog
      v-model="allVisible"
      title="全部消息"
      width="520px"
      append-to-body
      destroy-on-close
      @open="loadAll"
    >
      <message-list-panel :list="allList" @list-change="loadAll" />
    </el-dialog>
  </header>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox, ElMessage } from "element-plus";
import {
  Bell,
  ArrowDown,
  UserFilled,
  Close,
  Clock,
  Right,
} from "@element-plus/icons-vue";
import ChangePasswordDialog from "./ChangePasswordDialog.vue";
import MessageListPanel from "@/views/system/notice/MessageListPanel.vue";
import { useActiveMenu } from "@/composables/useActiveMenu";
import { useUserStore } from "@/store/user";
import { useAiStore } from "@/store/ai";
import { useNoticeUnread } from "@/composables/useNoticeUnread";
import { getNoticePage, markNoticeRead, markNoticeAllRead } from "@/api/system";
import { resetRouter } from "@/router";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { topMenus, activeTop } = useActiveMenu();

/**
 * AI 入口的「伪菜单项」。
 *
 * 它不在后端菜单树里（sys_menu 中的 80/8001 只承载权限点、不产生路由），
 * 所以在这里手工插一项。**带真实的 path**，点击就是普通跳转 ——
 * `handleSelect` 不用为它写任何特例。
 *
 * ⚠️ 路径必须是 `router/index.js` 里静态注册过的那条，否则
 *    `check:static` 的「写死的路由路径都存在」会报出来（这道检查正需要）。
 */
const AI_NAV_ITEM = { menuName: "AI小助手", path: "/ai/chat" };

/**
 * 顶部导航项 = 后端菜单树 + AI 入口。
 *
 * AI 入口插在**倒数第一位**（即一级导航最后一项「系统设置」的左边）。
 * 没有权限时不插 —— 与悬浮球、快捷入口的显示条件保持一致。
 */
const navItems = computed(() => {
  const list = [...topMenus.value];
  if (!userStore.hasPermission("ai:chat:use")) {
    return list;
  }
  list.splice(Math.max(0, list.length - 1), 0, AI_NAV_ITEM);
  return list;
});

const passwordDialogRef = ref(null);

const isMock = import.meta.env.VITE_APP_USE_MOCK === "true";

// ---------- 消息铃铛 ----------
const { unreadCount, refreshUnreadCount, decrementUnread } = useNoticeUnread();
const loading = ref(false);
const unreadList = ref([]);
const detailVisible = ref(false);
const current = ref(null);
// 「查看全部消息」弹窗（未读气泡底部那个入口）
const allVisible = ref(false);
const allList = ref([]);

const TYPE_COLORS = {
  approval: "#28d094",
  notice: "#f59a23",
  announcement: "#2c6ddb",
};
const tagColor = (type) => TYPE_COLORS[type] || "#6b778c";
const accent = (type) => TYPE_COLORS[type] || "#6b778c";
const typeTagType = (type) =>
  type === "announcement"
    ? "warning"
    : type === "approval"
      ? "success"
      : "primary";
const fmtTime = (t) => (t ? String(t).replace("T", " ").slice(0, 16) : "");

async function loadUnread() {
  loading.value = true;
  try {
    const data = await getNoticePage({ pageNo: 1, pageSize: 20, isRead: 0 });
    unreadList.value = data?.list || [];
  } catch {
    unreadList.value = [];
  } finally {
    loading.value = false;
  }
}

function onBellOpen() {
  loadUnread();
  refreshUnreadCount();
}

async function onPick(item) {
  current.value = item;
  detailVisible.value = true;
  if (item.isRead === 0) {
    await markNoticeRead(item.id);
    item.isRead = 1;
    decrementUnread(1);
  }
  unreadList.value = unreadList.value.filter((i) => i.isRead === 0);
}

async function onReadAll() {
  await markNoticeAllRead();
  refreshUnreadCount();
  unreadList.value = [];
  ElMessage.success("已全部标记已读");
}

/**
 * 「查看全部」→ 打开全部消息弹窗。
 *
 * ⚠️ **不要**改回 `router.push("/system/notice")`：那条路由已经随
 * 「菜单与权限点被移除」一起不存在了，跳过去是 404（见 BUG-021）。
 * 弹窗里用的 MessageListPanel 与「消息列表」页是同一个组件，行为一致。
 */
function goAll() {
  allVisible.value = true;
  loadAll();
}

async function loadAll() {
  try {
    const data = await getNoticePage({ pageNo: 1, pageSize: 50 });
    allList.value = data?.list || [];
  } catch {
    // 与 loadUnread 同一口径：拉不到就当空列表。
    // ⚠️ 必须自己吞掉 —— 调用它的是 @open 和未读气泡的点击，都不是 await 调用，
    //    抛出去就是一个没人接的 unhandledrejection。
    allList.value = [];
  }
}

function goBiz() {
  if (current.value?.bizType === "customer") {
    router.push(`/crm/customer/${current.value.bizId}`);
  }
}

onMounted(() => {
  refreshUnreadCount();
});

/**
 * 点击一级导航
 *
 * 目录型节点（有 children）跳到它下面第一个二级页；
 * 首页这种没有 children 的，直接跳自身 path。
 *
 * 已经在目标页时不做跳转 —— 否则在客户列表点「客户」会白跑一次导航。
 *
 * ⚠️ `router.push` 的返回值必须接住：它是个 Promise，**被守卫重定向、
 *    或目标路由不存在时会 reject**。不接住的话表现就是「点了没反应」，
 *    控制台一声不吭，非常难查。这里至少让它出声。
 */
/**
 * 一级导航的选中态。
 *
 * 菜单项按 `menuId` 比（后端菜单树给的）；AI 那个是前端手工插的、没有 menuId，
 * 所以按当前路由判 —— 否则站在 /ai/chat 上时它不会高亮。
 */
function isActive(item) {
  if (item.menuId == null) {
    return route.path.startsWith(item.path);
  }
  return item.menuId === activeTop?.menuId;
}

function handleSelect(item) {
  const target = item.children?.[0]?.path || item.path;
  if (!target || target === route.path) return;

  router.push(target).catch((e) => {
    console.error(
      `[顶部导航] 跳转到「${item.menuName}」(${target}) 失败。` +
        `当前路径 ${route.path}，已注册路由数 ${router.getRoutes().length}`,
      e,
    );
  });
}

async function handleCommand(command) {
  if (command === "password") {
    passwordDialogRef.value?.open();
    return;
  }

  if (command === "profile") {
    // 个人信息改为整页（views/profile），不再弹窗
    router.push("/profile");
    return;
  }

  try {
    await ElMessageBox.confirm("确定要退出登录吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return; // 用户取消
  }

  await userStore.logout();
  // 必须重置路由：否则下次登录时 dynamicRoutes 非空，
  // 守卫会跳过「拉菜单 + 注册路由」，换账号后看到的还是上一个人的菜单
  resetRouter();

  ElMessage.success("已退出登录");
  router.push("/login");
}
</script>

<style scoped lang="scss">
.top-nav {
  height: var(--crm-navbar-height);
  display: flex;
  align-items: center;
  background-color: var(--crm-primary);
  color: #fff;
  padding: 0 24px;
  flex-shrink: 0;
}

.top-nav__brand {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  white-space: nowrap;
}

.top-nav__menu {
  display: flex;
  align-items: center;
  margin-left: 40px;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.top-nav__item {
  height: 44px;
  line-height: 44px;
  padding: 0 18px;
  margin-right: 8px;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.14);
  }

  &.is-active {
    background-color: rgba(255, 255, 255, 0.22);
    font-weight: 600;
  }
}

.top-nav__right {
  display: flex;
  align-items: center;
  gap: 20px;

  .top-nav__mock {
    background: transparent;
    color: #fff;
    border-color: rgba(255, 255, 255, 0.6);
  }

  .top-nav__bell {
    cursor: pointer;
    color: #fff;
    // el-badge 的数字默认是红色，在蓝底上不协调，改成白色描边
    :deep(.el-badge__content) {
      border-color: var(--crm-primary);
    }
  }

  .top-nav__user {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #fff;
    outline: none;

    .top-nav__user-name {
      font-size: 14px;
    }
  }
}

// ---------- 消息铃铛气泡与详情 ----------
.top-nav__bell-loading {
  height: 120px;
}

.top-nav__bell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.top-nav__bell-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.top-nav__bell-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--crm-border-light);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--crm-fill-light, #f5f7fa);
  }
}

.top-nav__bell-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #fff;
  line-height: 18px;
}

.top-nav__bell-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--crm-text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-nav__bell-time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--crm-text-secondary);
}

.top-nav__bell-foot {
  text-align: center;
  padding: 8px 0 2px;
}

.top-nav__detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.top-nav__detail-time {
  font-size: 12px;
  color: var(--crm-text-secondary);
}

.top-nav__detail-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--crm-text-regular);
  white-space: pre-wrap;
}

.top-nav__detail-link {
  display: inline-block;
  margin-top: 12px;
  font-size: 13px;
  color: var(--crm-primary);
  cursor: pointer;
}

// ---------- 消息详情弹窗（大气版） ----------
:deep(.notice-detail-dialog) {
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);

  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    padding: 0;
  }
}

.notice-detail {
  display: flex;
  flex-direction: column;
  font-family: inherit;
}

// 头部：分类色带 + 图标 + 标题 + 关闭
.notice-detail__hero {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 26px 26px 22px;
  color: #fff;
  overflow: hidden;
  // 顶部一条分类色带
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 82%, #fff 0%) 0%,
    var(--accent) 100%
  );

  // 右上角装饰性光斑
  &::after {
    content: "";
    position: absolute;
    right: -30px;
    top: -40px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
  }
}

.notice-detail__icon {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}

.notice-detail__head {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1;
}

.notice-detail__tag {
  display: inline-block;
  padding: 2px 10px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  letter-spacing: 0.5px;
}

.notice-detail__title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-word;
}

.notice-detail__close {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  color: #fff;
  &:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.28);
  }
}

// 正文
.notice-detail__body {
  padding: 24px 26px;
}

.notice-detail__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--crm-text-secondary);
}

.notice-detail__meta-ico {
  font-size: 15px;
}

.notice-detail__content {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--crm-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

// 底部操作区
.notice-detail__foot {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 26px 22px;
  border-top: 1px solid var(--crm-border-light);

  .notice-detail__action {
    padding-left: 22px;
    padding-right: 22px;
  }
}
</style>
