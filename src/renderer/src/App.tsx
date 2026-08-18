import { Button } from '@pi-desktop/shadcn-ui/components/button';

export function App() {
  return (
    <div className="min-h-svh">
      <header className="draggable h-[46px]" />
      <main>
        <h1>Electron + React + Vite</h1>
        <Button variant="default">Default Button</Button>
      </main>
    </div>
  );
}
