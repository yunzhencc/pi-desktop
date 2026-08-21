# AGENTS.md

pi-desktop 是 Pi Coding Agent 的 Electron 桌面端。修改代码前先确认当前调用链和已有模式；能复用项目内实现时不要另起一套。

## 仓库结构

```text
src/main/        Electron 主进程：窗口、IPC、PiRuntime、工作区/会话持久化、系统能力
src/preload/     渲染进程可见的窄 API；保持类型声明和实现同步
src/shared/      主进程、preload、renderer 共用的纯类型和常量
src/renderer/    React 渲染进程：路由、页面、功能模块和样式
packages/        工作区包；shadcn-ui 为本地 UI 组件，utils 为共享工具
docs/            已批准设计和执行计划；实现新能力前先读相关文档
scripts/         仓库脚本；clean.ts 只清理明确安全的构建产物
.agents/skills/  本仓库附带的 Agent 技能说明
```

渲染端当前分层是 `pages -> features -> components/model/utils`。跨功能复用先放到已有共享层；不要因为一个调用点新增抽象或顶层 feature。

## 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # Electron 开发模式
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint
pnpm build        # typecheck + electron-vite build
pnpm build:mac    # macOS 打包
pnpm build:win    # Windows 打包
pnpm build:linux  # Linux 打包
```

提交前只运行与改动相关的最小检查；不要把全量构建当作每次小改的默认动作。遇到沙箱、网络、端口或权限失败，要按实际失败报告，不要当成源码问题。

## 架构边界

- 主进程拥有 Node、文件系统、系统弹窗、凭据、Pi SDK 和会话生命周期。
- preload 只暴露经过类型约束的最小 IPC API；新增能力时同步更新 `src/preload/index.ts` 和 `src/preload/index.d.ts`。
- renderer 不直接访问 Node、文件系统、凭据文件或 Pi SDK；它只消费 preload API 和渲染安全数据。
- `PiRuntime` 是应用自己的 Pi SDK 适配层。不要把 SDK 事件原样透传给 renderer，只传 UI 需要的稳定字段。
- 工作区和会话的持久化语义由 `src/main/workspaces.ts` 与 Pi 会话文件共同决定。修改选择、激活、置顶或排序前先追踪所有调用方。
- 路由文件由 TanStack Router 生成；不要手改 `src/renderer/src/routeTree.gen.ts`。

## 代码约定

- TypeScript 保持 `strict` 通过；不要用 `any` 绕过边界问题。
- ESM、单引号、分号、2 空格缩进；以 ESLint/现有文件风格为准。
- 本地相对导入和别名导入沿用当前写法：主进程可用 `@shared`，渲染端可用 `@renderer` 和 `@shared`。
- UI 组件优先复用 `@pi-desktop/shadcn-ui`、已有 feature 组件和 lucide 图标；不要新增依赖来替代几行代码。
- 样式先沿用同 feature 的 CSS 和设计变量；不要为局部改动重写整体视觉体系。
- 注释只写非显而易见的约束、原因或失败语义；不要复述代码。

## 前端 UI 规则

- UI 改动优先使用 Tailwind CSS utilities 和 `@pi-desktop/shadcn-ui` 组件。
- 使用组件前先检查 `packages/shadcn-ui/src/components`；缺少组件时，优先用 shadcn 官方 CLI 添加。
- 不手写已有 shadcn 能覆盖的组件，不新增 UI 依赖替代 shadcn/Tailwind。
- 默认不新增普通 CSS class；仅在复用旧样式、复杂选择器/媒体查询、第三方组件内部样式或 Tailwind 表达不清时使用。
- 若偏离以上规则，在回复中说明原因。

## 测试和验证

- 非平凡逻辑改动要留下一个能失败的检查：优先补同目录 Vitest，或运行已有目标测试。
- 主进程逻辑优先测纯函数、持久化语义、IPC 入参校验和错误转换。
- renderer 逻辑优先测用户可见行为、状态转换和导入路径；Vitest mock 必须匹配生产代码的真实 import specifier。
- 样式/布局改动至少跑相关 `*.style.test.ts` 或组件测试；视觉一致性结论需要实际截图或明确说明未验证。
- 文档或注释纯改动通常不需要测试，但最终回复要说明未运行测试。

## 编辑规则

- 先看当前工作区状态；不要覆盖或回退用户已有改动。
- 修 bug 要修共享根因，不要只在报错入口补局部兜底。
- 新增依赖、扩大 preload API、改变会话持久化格式、调整工作区排序语义，都需要明确理由和对应验证。
- 能删代码就不要新增配置；能复用现有 helper 就不要复制实现。
- 文件结尾保留一个换行。
