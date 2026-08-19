import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type DeepSeekModel = typeof DEEPSEEK_MODELS[number];

export interface DeepSeekConfiguration {
  apiKey: string;
  model: DeepSeekModel;
}

export interface DeepSeekSettingsSnapshot {
  configured: boolean;
  model: DeepSeekModel;
}

interface SecretStorage {
  decryptString: (value: Buffer) => string;
  encryptString: (value: string) => Buffer;
}

interface StoredSettings {
  apiKey: string;
  model: DeepSeekModel;
}

export class DeepSeekSettings {
  #configuration: DeepSeekConfiguration | undefined;

  constructor(
    private readonly path: string,
    private readonly secretStorage: SecretStorage,
  ) {}

  async load(): Promise<DeepSeekConfiguration | undefined> {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8')) as StoredSettings;
      if (!isModel(value.model) || typeof value.apiKey !== 'string')
        return undefined;

      const apiKey = this.secretStorage.decryptString(Buffer.from(value.apiKey, 'base64')).trim();
      this.#configuration = apiKey ? { apiKey, model: value.model } : undefined;
    }
    catch {
      this.#configuration = undefined;
    }
    return this.#configuration;
  }

  async save(apiKey: string, model: DeepSeekModel): Promise<DeepSeekSettingsSnapshot> {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey)
      throw new TypeError('DeepSeek API Key 不能为空');
    if (!isModel(model))
      throw new TypeError('无效的 DeepSeek 模型');

    this.#configuration = { apiKey: normalizedKey, model };
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify({
      apiKey: this.secretStorage.encryptString(normalizedKey).toString('base64'),
      model,
    }), { encoding: 'utf8', mode: 0o600 });
    return this.snapshot();
  }

  snapshot(): DeepSeekSettingsSnapshot {
    return { configured: Boolean(this.#configuration), model: this.#configuration?.model ?? 'deepseek-v4-flash' };
  }

  configuration(): DeepSeekConfiguration | undefined {
    return this.#configuration;
  }
}

function isModel(value: unknown): value is DeepSeekModel {
  return typeof value === 'string' && DEEPSEEK_MODELS.includes(value as DeepSeekModel);
}
