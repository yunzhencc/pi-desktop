import { Enum } from 'enum-plus';

export const IPC_CHANNELS = Enum({
  Ping: 'ping',

  WindowIsFullScreen: 'window:is-full-screen',
  WindowIsOpaqueSurface: 'window:is-opaque-surface',
  WindowSetThemeSource: 'window:set-theme-source',
  WindowFullScreenChanged: 'window-fullscreen-changed',
  WindowOpaqueSurfaceChanged: 'window-opaque-surface-changed',

  AppUpdatesGet: 'app-updates:get',
  AppUpdatesInstall: 'app-updates:install',
  AppUpdatesChanged: 'app-updates:changed',

  ProvidersGet: 'providers:get',
  ProvidersApiKeySave: 'providers:api-key:save',
  ProvidersRemove: 'providers:remove',
  ProvidersChatGptLogin: 'providers:chatgpt:login',
  ProvidersPrimarySet: 'providers:primary:set',
  ProvidersScopeSet: 'providers:scope:set',
  ProvidersDefaultModelSet: 'providers:default-model:set',
  ProvidersChanged: 'providers:changed',

  WorkspacesGet: 'workspaces:get',
  WorkspacesSetPinned: 'workspaces:set-pinned',
  WorkspacesClear: 'workspaces:clear',
  WorkspacesGetGitBranch: 'workspaces:get-git-branch',
  WorkspacesPickDirectory: 'workspaces:pick-directory',
  WorkspacesOpenDirectory: 'workspaces:open-directory',
  WorkspacesCreate: 'workspaces:create',
  WorkspacesUpdate: 'workspaces:update',
  WorkspacesSelect: 'workspaces:select',

  SessionsList: 'sessions:list',
  SessionsGetUsageStats: 'sessions:get-usage-stats',
  SessionsOpen: 'sessions:open',
  SessionsSetPinned: 'sessions:set-pinned',

  ComposerAddAttachments: 'composer:add-attachments',
  ComposerAddClipboardAttachments: 'composer:add-clipboard-attachments',
  ComposerAddPastedImage: 'composer:add-pasted-image',
  ComposerRevealAttachment: 'composer:reveal-attachment',
  ComposerRemoveAttachment: 'composer:remove-attachment',
  ComposerSend: 'composer:send',
  ComposerEditLastUserMessage: 'composer:edit-last-user-message',
  ComposerForkAssistantMessage: 'composer:fork-assistant-message',
  ComposerSetUserMessageBookmarked: 'composer:set-user-message-bookmarked',
  ComposerNewConversation: 'composer:new-conversation',
  ComposerStop: 'composer:stop',
  ComposerUpdate: 'composer:update',
});
