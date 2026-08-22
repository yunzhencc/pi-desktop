import type { PiAppAPI } from './pi-app-api';

declare global {
  interface Window {
    piApp: PiAppAPI;
  }
}

export {};
