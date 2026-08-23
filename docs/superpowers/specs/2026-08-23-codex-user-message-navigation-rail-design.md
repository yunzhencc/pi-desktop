# Codex 用户消息导航轨设计

## 目标

在 Pi 对话页实现与 Codex 一致的用户消息导航轨：四条用户消息起显示左侧阶梯短线，反映可见消息，支持点击、拖拽、悬停预览、书签、`Alt+Up`/`Alt+Down` 和减少动态效果。

## 边界

- 复用 `ThreadScrollLayout` 的原生滚动容器、虚拟 turn 和 `data-thread-turn`；不增加滚动容器或虚拟列表依赖。
- 导航目标是 `role === 'user'` 的消息，活动与助手消息不单独生成标记。
- 书签写入 Pi 会话 JSONL 的 `custom` 条目，不修改 SDK 管理的既有记录。
- 自定义条目类型固定为 `pi-desktop-turn-bookmark`，数据为 `{ userEntryId, bookmarked }`；恢复时以每个 `userEntryId` 的最后一次写入为准。

## 数据与进程边界

Pi 的历史用户消息已有 SDK entry ID。当前发送消息在 renderer 只有本地 ID，因此主进程在 `message_end` 用户事件中通过会话分支取得最后一个用户 entry ID，并以 `TranscriptUpdate` 回传。renderer 将该 ID 回填到最近一个未绑定的用户消息。

书签操作由 renderer 调用 preload 的窄 API，主进程校验 user entry ID 后调用 `SessionManager.appendCustomEntry`。`openSession()` 读取分支中的自定义条目，返回 `bookmarkedUserEntryIds`，使历史打开、会话分支和重启恢复同一状态。

## 导航组件

`ThreadScrollLayout` 接收用户导航 items 和书签切换回调，继续作为滚动位置、虚拟渲染和滚动到底部按钮的唯一所有者。导航轨组件在浏览器空闲时延迟挂载；不足四个 item 时不渲染。

它以 `IntersectionObserver` 观察已挂载的用户 turn，根为滚动容器、顶部根边距为 16px；当前可见 item 使用 `aria-current`。虚拟化导致目标未挂载时，组件先按 turn key 调整 `scrollTop` 使其进入可见区，再于下一帧调用目标 `scrollIntoView`。

每个标记是可聚焦 button。点击平滑滚动并闪烁目标用户消息；按住主按钮并移动时即时滚动到指针下的条目。悬停或焦点显示用户输入与相邻助手回复的预览，书签按钮位于预览中。`Alt+Up` 与 `Alt+Down` 在用户消息之间平滑跳转。减少动态效果时所有 CSS 过渡、平滑滚动和闪烁均立即完成。

## 视觉与无障碍

导航轨定位为滚动视图内左侧 16px、垂直居中、`z-index: 20`。每项为 `36px x 10px`，线条宽 26px；默认长度 23.08%，目标/悬停项全长，前后 1/2/3 项为 70%/40%/20%。书签为同色小圆点。列表可滚动、最大高度为 `min(70vh, 40rem)`，边缘渐隐。

使用语义 `nav`、本地化 `aria-label`、每个 button 的消息序号标签、`aria-current` 和预览描述关系。所有交互都保留键盘路径。

## 验证

覆盖自定义书签序列化/恢复、user-entry ID 回填、四项阈值、可见高亮、平滑点击、拖拽即时定位、快捷键、减少动态效果和书签切换。运行相关主进程、renderer 与样式 Vitest，再运行类型检查和 `git diff --check`。
