import { Enum } from 'enum-plus';

export const IPC_CHANNELS = Enum({
  /** 获取模型列表 */
  ModelList: 'ipc:model.list',
});
