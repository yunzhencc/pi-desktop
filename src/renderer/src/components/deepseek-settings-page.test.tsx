// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekSettingsView } from './deepseek-settings-page';

describe('deepSeekSettingsView', () => {
  afterEach(cleanup);

  it('reflects the configured model after the provider snapshot loads', () => {
    const { container, rerender } = render(
      <IntlProvider
        locale="zh-CN"
        messages={{
          'providers.deepseek.apiKey': 'API Key',
          'providers.deepseek.configured': '已配置',
          'providers.deepseek.description': '使用 DeepSeek 与 AI 对话。',
          'providers.deepseek.model': '模型',
          'providers.deepseek.save': '保存',
          'providers.deepseek.title': 'DeepSeek',
          'providers.title': 'Providers',
        }}
      >
        <DeepSeekSettingsView configured={false} model="deepseek-v4-flash" onSave={vi.fn()} />
      </IntlProvider>,
    );

    rerender(
      <IntlProvider
        locale="zh-CN"
        messages={{
          'providers.deepseek.apiKey': 'API Key',
          'providers.deepseek.configured': '已配置',
          'providers.deepseek.description': '使用 DeepSeek 与 AI 对话。',
          'providers.deepseek.model': '模型',
          'providers.deepseek.save': '保存',
          'providers.deepseek.title': 'DeepSeek',
          'providers.title': 'Providers',
        }}
      >
        <DeepSeekSettingsView configured model="deepseek-v4-pro" onSave={vi.fn()} />
      </IntlProvider>,
    );

    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('combobox', { name: '模型' }).textContent).toContain('DeepSeek V4 Pro');
  });

  it('submits the DeepSeek API key and selected model without rendering the saved key', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <IntlProvider
        locale="zh-CN"
        messages={{
          'providers.deepseek.apiKey': 'API Key',
          'providers.deepseek.configured': '已配置',
          'providers.deepseek.description': '使用 DeepSeek 与 AI 对话。',
          'providers.deepseek.model': '模型',
          'providers.deepseek.save': '保存',
          'providers.deepseek.title': 'DeepSeek',
          'providers.title': 'Providers',
        }}
      >
        <DeepSeekSettingsView configured={false} model="deepseek-v4-flash" onSave={onSave} />
      </IntlProvider>,
    );

    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-secret' } });
    fireEvent.click(screen.getByRole('combobox', { name: '模型' }));
    const proModel = screen.getByRole('option', { name: 'DeepSeek V4 Pro' });
    fireEvent.pointerDown(proModel);
    fireEvent.click(proModel);
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('sk-secret', 'deepseek-v4-pro'));
    await waitFor(() => expect(screen.queryByDisplayValue('sk-secret')).toBeNull());
  });
});
