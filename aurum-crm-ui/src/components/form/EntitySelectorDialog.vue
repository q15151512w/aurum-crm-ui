<template>
  <!--
    通用选择器弹窗

    原型上「选择客户 / 选择商机 / 选择报价单 / 选择角色人员 / 负责人」是一整页 HTML
    （Axure 用整页跳转模拟弹窗），这里按实际开发需要做成真 Modal：
    搜索框 + 分页表格 + 单选/多选。

    具体选什么由 selectorKey 决定，见 constants/selectorRegistry.js。
  -->
  <el-dialog
    :model-value="modelValue"
    :title="config?.title || '请选择'"
    width="860px"
    class="crm-selector-dialog"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @open="handleOpen"
  >
    <div class="crm-selector__body" :class="{ 'is-tree': withTree }">
      <!--
        左侧组织架构树（withDeptTree 配置开启时才有，原型上负责人就是左树右表）

        点部门按子树过滤右侧人员；再点一次同一个节点取消过滤。
        树头部的搜索图标展开一个小输入框，只过滤树节点、不影响右侧表格。
      -->
      <aside v-if="withTree" class="crm-selector__tree">
        <div
          class="crm-selector__tree-header"
          @click="showTreeSearch = !showTreeSearch"
        >
          <span>组织架构</span>
          <el-icon><Search /></el-icon>
        </div>
        <el-input
          v-if="showTreeSearch"
          v-model="treeKeyword"
          size="small"
          clearable
          placeholder="搜索部门"
          class="crm-selector__tree-search"
        />
        <el-tree
          ref="treeRef"
          :data="deptTreeData"
          :props="{ label: 'name', children: 'children' }"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          :filter-node-method="filterTreeNode"
          @node-click="handleDeptClick"
        />
      </aside>

      <div class="crm-selector__main">
        <el-input
          v-model="query.keyword"
          :placeholder="config?.searchPlaceholder || '请输入关键字'"
          class="crm-selector__search"
          clearable
          @keyup.enter="triggerSearch"
          @clear="triggerSearch"
        >
          <template #suffix>
            <el-icon class="crm-selector__search-icon" @click="triggerSearch"
              ><Search
            /></el-icon>
          </template>
        </el-input>

        <el-table
          v-loading="loading"
          :data="displayList"
          height="360"
          highlight-current-row
          @selection-change="handleSelectionChange"
          @row-dblclick="handleDblClick"
        >
          <!-- 多选：勾选框 -->
          <el-table-column
            v-if="isMultiple"
            type="selection"
            width="54"
            align="center"
          />

          <!-- 单选：单选圈。用 el-radio 只是要那个视觉，选中态由 selectedId 统一管 -->
          <el-table-column v-else width="54" align="center">
            <template #default="{ row }">
              <el-radio
                :model-value="selectedId"
                :value="row.id"
                @update:model-value="selectedId = row.id"
              />
            </template>
          </el-table-column>

          <el-table-column
            v-for="col in config?.columns || []"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :min-width="col.minWidth || 100"
            :width="col.width"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ col.format ? col.format(row[col.prop]) : dash(row[col.prop]) }}
            </template>
          </el-table-column>
        </el-table>

        <!-- 树模式下是一次取全量 + 前端过滤，没有分页 -->
        <div v-if="!withTree" class="pagination-container">
          <el-pagination
            :current-page="query.pageNo"
            :page-size="query.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="total"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" @click="handleConfirm">确定</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { Search } from "@element-plus/icons-vue";
import { useTable } from "@/composables/useTable";
import { getSelectorConfig } from "@/constants/selectorRegistry";
// ⚠️ 必须用 getDeptOptions（仅需登录），不能用 getDeptTree（要求 system:dept:list，
//    只有超管有）—— 否则销售角色一打开选择器就弹权限报错。
//    详见 api/system.js 里 getDeptOptions 的注释。
import { getDeptOptions } from "@/api/system";

const props = defineProps({
  /** 弹窗开关 */
  modelValue: { type: Boolean, default: false },
  /** 注册表里的 key，见 constants/selectorRegistry.js */
  selectorKey: { type: String, required: true },
  requestParams: { type: Object, default: () => ({}) },
});

/** confirm 传出的是**行数组**，单选也是长度为 1 的数组 */
const emit = defineEmits(["update:modelValue", "confirm"]);

const config = computed(() => getSelectorConfig(props.selectorKey));
const isMultiple = computed(() => !!config.value?.multiple);

/** selectorKey 是静态的，配置在 setup 时取一次就够（决定 pageSize 与布局） */
const withTree = !!getSelectorConfig(props.selectorKey)?.withDeptTree;

const selectedId = ref(null);
const selectionRows = ref([]);

/**
 * 取数函数要的是一个稳定的引用
 *
 * config.api 是注册表里定死的函数，但 config 是 computed —— 每次求值都拿到同一个
 * api 引用，所以这里包一层箭头函数，避免 useTable 里依赖 props 变化导致重建。
 *
 * 树模式（withDeptTree）一次取全量，部门/关键字过滤都在前端做，
 * 这样切换部门时已选中的行不会因为重新请求被清掉。
 */
const {
  loading,
  list,
  total,
  query,
  reload,
  handlePageChange,
  handleSizeChange,
} = useTable(
  (params) => config.value.api({ ...params, ...props.requestParams }),
  {
    pageSize: withTree ? 9999 : 10,
  },
);

const dash = (v) => (v === null || v === undefined || v === "" ? "--" : v);

// ---------------------------------------------------------------------------
// 组织架构树（withDeptTree）
// ---------------------------------------------------------------------------

const deptTreeData = ref([]);
const treeRef = ref(null);
const treeKeyword = ref("");
const showTreeSearch = ref(false);
/** 当前点选的部门节点；null 表示不过滤（全部人员） */
const selectedDept = ref(null);

async function loadDeptTree() {
  if (deptTreeData.value.length) return;
  try {
    deptTreeData.value = (await getDeptOptions()) || [];
  } catch {
    // 失败提示已由 request.js 统一处理；树挂了选择器本身还能用
    deptTreeData.value = [];
  }
}

/** 收集节点及其全部子孙的 id —— 点父部门要能看到子部门的人 */
function collectDeptIds(node) {
  const ids = new Set();
  const walk = (n) => {
    ids.add(Number(n.id));
    (n.children || []).forEach(walk);
  };
  walk(node);
  return ids;
}

/** 部门子树 + 关键字的前端过滤结果（树模式下表格显示这份） */
const displayList = computed(() => {
  if (!withTree) return list.value;
  let rows = list.value;
  if (selectedDept.value) {
    const ids = collectDeptIds(selectedDept.value);
    rows = rows.filter(
      (r) =>
        ids.has(Number(r.deptId)) || r.deptName === selectedDept.value.name,
    );
  }
  const kw = (query.keyword || "").trim().toLowerCase();
  if (kw) {
    rows = rows.filter((r) =>
      [r.name, r.phone, r.deptName, r.username, r.roleName].some(
        (v) => v != null && String(v).toLowerCase().includes(kw),
      ),
    );
  }
  return rows;
});

/** 再点同一个部门 = 取消过滤，回到全部人员 */
function handleDeptClick(data) {
  if (selectedDept.value?.id === data.id) {
    selectedDept.value = null;
    treeRef.value?.setCurrentKey(null);
  } else {
    selectedDept.value = data;
  }
}

watch(treeKeyword, (val) => treeRef.value?.filter(val));

function filterTreeNode(value, data) {
  if (!value) return true;
  return !!data.name?.includes(value);
}

function handleSelectionChange(rows) {
  selectionRows.value = rows;
}

/** 树模式的关键字是前端过滤（displayList 自动响应），不用打服务端 */
function triggerSearch() {
  if (!withTree) reload();
}

function handleOpen() {
  // 每次打开都从干净状态开始，否则上次搜的关键字和勾选会带进来
  query.keyword = "";
  selectedId.value = null;
  selectionRows.value = [];
  if (withTree) {
    loadDeptTree();
    selectedDept.value = null;
    treeKeyword.value = "";
    showTreeSearch.value = false;
  }
  reload();
}

// 列表换页/搜索后旧的选中项已经不在当前页，清掉免得「确定」时找不到
watch(list, () => {
  selectedId.value = null;
  selectionRows.value = [];
});

function handleDblClick(row) {
  if (isMultiple.value) return;
  selectedId.value = row.id;
  handleConfirm();
}

function handleConfirm() {
  if (isMultiple.value) {
    if (!selectionRows.value.length)
      return ElMessage.warning("请至少选择一条记录");
    emit("confirm", selectionRows.value);
  } else {
    // 注意从 list（全量）里找，而不是 displayList —— 树模式下选中行可能被部门过滤藏起来了
    const row = list.value.find(
      (r) => String(r.id) === String(selectedId.value),
    );
    if (!row) return ElMessage.warning("请选择一条记录");
    emit("confirm", [row]);
  }
  emit("update:modelValue", false);
}
</script>

<style scoped lang="scss">
.crm-selector__search {
  width: 260px;
  margin-bottom: 12px;
}

.crm-selector__search-icon {
  cursor: pointer;
}

.crm-selector__body.is-tree {
  display: flex;
  gap: 12px;
}

.crm-selector__tree {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 190px;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  border-radius: 4px;
}

.crm-selector__tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-weight: 600;
  color: var(--crm-text-primary);
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 3px 3px 0 0;
  cursor: pointer;

  .el-icon:hover {
    color: var(--crm-primary);
  }
}

.crm-selector__tree-search {
  margin: 8px 8px 0;
}

.crm-selector__tree :deep(.el-tree) {
  flex: 1;
  min-height: 0;
  padding: 4px;
  overflow: auto;
}

.crm-selector__main {
  flex: 1;
  min-width: 0;
}
</style>
