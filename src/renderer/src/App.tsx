import { BasicLayout } from '@renderer/features/layout';
import { Outlet } from '@tanstack/react-router';

export function App() {
  return (
    <BasicLayout>
      <Outlet />
    </BasicLayout>
  );
}
