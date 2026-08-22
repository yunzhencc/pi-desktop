/* eslint-disable dot-notation */
import { SettingsManager } from '@earendil-works/pi-coding-agent';

export function isGlobalNpmLookupError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('npm root -g');
}

function filterOutNpmPackageSources(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const filtered = value.filter(entry => !isNpmPackageSource(entry));
  return filtered.length === value.length ? value : filtered;
}

function isNpmPackageSource(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().startsWith('npm:');
  }

  if (typeof value !== 'object' || value === null || !('source' in value)) {
    return false;
  }

  return typeof value.source === 'string' && value.source.trim().startsWith('npm:');
}

export function createSettingsManagerWithoutNpmPackages(current: SettingsManager): SettingsManager | null {
  const globalSettings = current.getGlobalSettings() as Record<string, unknown>;
  const projectSettings = current.getProjectSettings() as Record<string, unknown>;
  const nextGlobalPackages = filterOutNpmPackageSources(globalSettings['packages']);
  const nextProjectPackages = filterOutNpmPackageSources(projectSettings['packages']);

  const globalChanged = nextGlobalPackages !== globalSettings['packages'];
  const projectChanged = nextProjectPackages !== projectSettings['packages'];
  if (!globalChanged && !projectChanged) {
    return null;
  }

  const nextGlobalSettings = globalChanged ? { ...globalSettings, packages: nextGlobalPackages } : globalSettings;
  const nextProjectSettings = projectChanged ? { ...projectSettings, packages: nextProjectPackages } : projectSettings;
  return SettingsManager.fromStorage({
    withLock(scope, fn) {
      const currentJson
        = scope === 'global'
          ? JSON.stringify(nextGlobalSettings)
          : JSON.stringify(nextProjectSettings);
      fn(currentJson);
    },
  });
}
