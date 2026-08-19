import type { FormEvent } from 'react';
import { Folder, FolderPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

type WorkspaceSnapshot = Awaited<ReturnType<Window['api']['workspaces']['get']>>;

export function WorkspaceSidebar() {
  const { formatMessage } = useIntl();
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    void window.api.workspaces.get().then(setWorkspace);
  }, []);

  const update = (next: WorkspaceSnapshot) => {
    setWorkspace(next);
    window.dispatchEvent(new CustomEvent<WorkspaceSnapshot>('workspace-changed', { detail: next }));
  };

  const select = async (path: string) => update(await window.api.workspaces.select(path));

  return (
    <nav aria-label={formatMessage({ id: 'projects.title' })} className="workspace-sidebar">
      <div className="workspace-sidebar-heading">
        <span>{formatMessage({ id: 'projects.title' })}</span>
        <button aria-label={formatMessage({ id: 'projects.add' })} onClick={() => setIsCreating(true)} title={formatMessage({ id: 'projects.add' })} type="button"><FolderPlus aria-hidden="true" size={15} /></button>
      </div>
      <div className="workspace-sidebar-list">
        {workspace?.workspaces.map(item => (
          <button aria-current={item.path === workspace.selectedWorkspacePath ? 'page' : undefined} key={item.path} onClick={() => void select(item.path)} type="button">
            <Folder aria-hidden="true" size={15} />
            <span>{item.displayName}</span>
          </button>
        ))}
      </div>
      {isCreating && <CreateProjectDialog onClose={() => setIsCreating(false)} onCreated={update} />}
    </nav>
  );
}

function CreateProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (workspace: WorkspaceSnapshot) => void }) {
  const [name, setName] = useState('');
  const [sourcePath, setSourcePath] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickDirectory = async () => {
    const path = await window.api.workspaces.pickDirectory();
    if (path)
      setSourcePath(path);
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting)
      return;
    if (!name.trim() || !sourcePath) {
      setError('请填写项目名称并添加源文件夹');
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      onCreated(await window.api.workspaces.create(name.trim(), sourcePath));
      onClose();
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建项目失败');
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="project-dialog-backdrop" role="presentation">
      <form aria-labelledby="create-project-title" aria-modal="true" className="project-dialog" onSubmit={event => void create(event)} role="dialog">
        <div className="project-dialog-header">
          <h2 id="create-project-title">创建项目</h2>
          <button aria-label="关闭" onClick={onClose} type="button"><X aria-hidden="true" size={22} /></button>
        </div>
        <label className="project-dialog-name">
          <Folder aria-hidden="true" size={24} />
          <input aria-label="项目名称" autoFocus onChange={event => setName(event.target.value)} placeholder="项目名称" value={name} />
        </label>
        <span className="project-dialog-label">源文件夹</span>
        <button className="project-dialog-source" onClick={() => void pickDirectory()} type="button">
          <FolderPlus aria-hidden="true" size={28} />
          <span>{sourcePath ?? '添加 Codex 可读取和编辑的文件夹'}</span>
        </button>
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <div className="project-dialog-actions">
          <button onClick={onClose} type="button">取消</button>
          <button disabled={isSubmitting} type="submit">{isSubmitting ? '创建中…' : '创建项目'}</button>
        </div>
      </form>
    </div>
  );
}
