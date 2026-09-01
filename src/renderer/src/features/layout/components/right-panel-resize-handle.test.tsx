// @vitest-environment jsdom

import { messages } from '@renderer/features/app/i18n/locale';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { expect, it, vi } from 'vitest';
import { RightPanelResizeHandle } from './right-panel-resize-handle';

it('resizes the right panel when its divider is dragged', async () => {
  const onClose = vi.fn();
  const onResizeEnd = vi.fn();
  const onResizingChange = vi.fn();
  const onWidthChange = vi.fn();

  render(
    <IntlProvider locale="en" messages={messages.en}>
      <RightPanelResizeHandle
        mainContentWidth={1200}
        onClose={onClose}
        onResizeEnd={onResizeEnd}
        onResizingChange={onResizingChange}
        onWidthChange={onWidthChange}
        width={600}
      />
    </IntlProvider>,
  );

  const handle = screen.getByRole('separator', { name: 'Resize right panel' });
  fireEvent.pointerDown(handle, { button: 0, clientX: 700, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 600 });

  await waitFor(() => expect(onWidthChange).toHaveBeenLastCalledWith(700));
  fireEvent.pointerUp(window, { clientX: 600 });

  expect(onResizeEnd).toHaveBeenLastCalledWith(700);
  expect(onClose).not.toHaveBeenCalled();
});
