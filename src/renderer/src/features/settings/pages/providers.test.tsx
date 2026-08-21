// @vitest-environment jsdom

import type { ProvidersSnapshot } from '../../../../../main/provider-settings';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProvidersSettingsView } from './providers';

const messages: Record<string, string> = {
  'providers.add.close': '收起清单',
  'providers.add.open': '添加模型供应商',
  'providers.apiKey': 'API Key',
  'providers.apiKey.update': '更新 API Key',
  'providers.auth': '认证',
  'providers.availableList': '可接入',
  'providers.chatgpt.login': '登录 ChatGPT',
  'providers.connect': '接入',
  'providers.connectedList': '已接入',
  'providers.connected': '已接入',
  'providers.defaultModel': '默认模型',
  'providers.description': '管理 Pi 原生模型供应商、认证和默认模型。',
  'providers.empty': '还没有接入模型供应商。',
  'providers.modelSettings': '模型',
  'providers.noModels': '接入后会显示可用模型。',
  'providers.notConnected': '未接入',
  'providers.primary': '主供应商',
  'providers.remove': '移除',
  'providers.scope': '模型选择范围',
  'providers.scope.all': '已接入供应商',
  'providers.scope.primary': '主供应商',
  'providers.search': '搜索模型供应商',
  'providers.search.empty': '未找到供应商',
  'providers.search.placeholder': '搜索供应商',
  'providers.setPrimary': '设为主供应商',
  'providers.title': 'Providers',
};

const snapshot: ProvidersSnapshot = {
  availableProviders: [
    { authType: 'oauth', configured: false, id: 'openai-codex', models: [], name: 'ChatGPT', primary: true },
    { authType: 'api_key', configured: false, id: 'deepseek', models: [], name: 'DeepSeek', primary: false },
    { authType: 'api_key', configured: false, id: 'opencode-go', models: [], name: 'OpenCode Go', primary: false },
  ],
  connectedProviders: [],
  modelPickerScope: 'primary-provider',
  primaryProvider: 'openai-codex',
};

function renderView(viewSnapshot: ProvidersSnapshot, overrides: Partial<Parameters<typeof ProvidersSettingsView>[0]> = {}) {
  return render(
    <IntlProvider locale="zh-CN" messages={messages}>
      <ProvidersSettingsView
        onLoginChatGPT={vi.fn()}
        onRemove={vi.fn()}
        onSaveApiKey={vi.fn()}
        onSetDefaultModel={vi.fn()}
        onSetPrimaryProvider={vi.fn()}
        onSetScope={vi.fn()}
        snapshot={viewSnapshot}
        {...overrides}
      />
    </IntlProvider>,
  );
}

describe('providers settings view', () => {
  afterEach(cleanup);

  it('shows connected and available provider columns when nothing is connected', () => {
    const { container } = renderView(snapshot);

    expect(screen.queryByText('还没有接入模型供应商。')).toBeNull();
    expect(container.querySelector('.settings-provider-nav .settings-provider-nav-title')).toBeNull();
    expect(screen.getByRole('button', { name: '登录 ChatGPT' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /DeepSeek/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /OpenCode Go/ })).toBeTruthy();
  });

  it('renders only connected providers on the main page', () => {
    renderView({
      ...snapshot,
      connectedProviders: [{
        authType: 'api_key',
        configured: true,
        id: 'deepseek',
        models: [{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', providerId: 'deepseek', reasoning: true, supportsImages: false }],
        name: 'DeepSeek',
        primary: true,
      }],
    });

    expect(screen.getAllByText('主供应商').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'DeepSeek 默认模型' }).textContent).toContain('DeepSeek V4 Pro');
  });

  it('keeps connected providers before connectable providers without group headings', () => {
    const { container } = renderView({
      ...snapshot,
      connectedProviders: [{
        authType: 'api_key',
        configured: true,
        id: 'deepseek',
        models: [],
        name: 'DeepSeek',
        primary: true,
      }],
    });

    const providerButtons = screen.getAllByRole('button').filter(button => button.className.includes('settings-provider-nav-item'));

    expect(providerButtons.map(button => button.querySelector('strong')?.textContent)).toEqual(['DeepSeek', 'ChatGPT', 'OpenCode Go']);
    expect(container.querySelector('.settings-provider-nav .settings-provider-nav-title')).toBeNull();
  });

  it('filters providers with fuzzy search', () => {
    const { container } = renderView(snapshot);

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索模型供应商' }), { target: { value: 'ocg' } });

    const providerButtons = [...container.querySelectorAll('.settings-provider-nav-item')];
    expect(providerButtons.map(button => button.querySelector('strong')?.textContent)).toEqual(['OpenCode Go']);
  });

  it('submits API keys without keeping the key rendered', async () => {
    const onSaveApiKey = vi.fn().mockResolvedValue(snapshot);
    renderView(snapshot, { onSaveApiKey });

    fireEvent.click(screen.getByRole('button', { name: /DeepSeek/ }));
    fireEvent.change(screen.getAllByLabelText('API Key')[0], { target: { value: 'sk-secret' } });
    fireEvent.click(screen.getAllByRole('button', { name: '接入' })[0]);

    await waitFor(() => expect(onSaveApiKey).toHaveBeenCalledWith('deepseek', 'sk-secret'));
    await waitFor(() => expect(screen.queryByDisplayValue('sk-secret')).toBeNull());
  });
});
