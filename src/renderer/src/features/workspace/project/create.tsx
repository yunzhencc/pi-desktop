import type { WorkspaceSnapshot, WorkspaceSummary } from '@shared/types';
import type { SubmitEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@pi-desktop/shadcn-ui/components/dialog';
import { cn } from '@pi-desktop/shadcn-ui/lib/utils';
import { Folder, FolderPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useIntl } from 'react-intl';

export function CreateProjectDialog({ onClose, onCreated, project }: { onClose: () => void; onCreated: (workspace: WorkspaceSnapshot) => void; project?: WorkspaceSummary }) {
  const { formatMessage } = useIntl();
  const isEditing = project !== undefined;
  const [name, setName] = useState(project?.displayName ?? '');
  const [sourcePath, setSourcePath] = useState<string | undefined>(project?.path);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickDirectory = async () => {
    if (isSubmitting)
      return;
    const path = await window.piApp.workspaces.pickDirectory();
    if (path) {
      setSourcePath(path);
      setError(undefined);
    }
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting)
      return;
    if (!sourcePath) {
      setError(formatMessage({ id: 'projects.error.sourceRequired' }));
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      onCreated(isEditing
        ? await window.piApp.workspaces.update(project.path, name.trim(), sourcePath)
        : await window.piApp.workspaces.create(name.trim(), sourcePath));
      onClose();
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : isEditing ? formatMessage({ id: 'projects.saveFailed' }) : formatMessage({ id: 'projects.createFailed' }));
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !isSubmitting)
          onClose();
      }}
      open
    >
      <DialogContent
        className="block w-[min(448px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border-[0.5px] border-border-subtle bg-surface p-5 shadow-[0_8px_24px_color-mix(in_srgb,#000_20%,transparent)] ring-0"
        showCloseButton={false}
      >
        <form aria-labelledby="create-project-title" onSubmit={event => void submit(event)}>
          <div className="mb-4 flex items-center justify-between">
            <DialogTitle className="m-0 text-[18px] leading-normal font-normal text-foreground" id="create-project-title">{formatMessage({ id: isEditing ? 'projects.editProject' : 'projects.create' })}</DialogTitle>
            <button
              aria-label={formatMessage({ id: 'common.close' })}
              className="grid size-6 place-items-center rounded-lg text-text-tertiary hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="size-3" size={22} />
            </button>
          </div>
          <label className="flex h-10 items-center rounded-xl border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-text-tertiary focus-within:border-focus">
            <Folder aria-hidden="true" className="box-content size-4 border-r border-border-subtle px-3" size={24} />
            <input
              aria-label={formatMessage({ id: 'projects.name' })}
              autoFocus
              className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-foreground outline-0 placeholder:text-text-tertiary"
              onChange={(event) => {
                setName(event.target.value);
                setError(undefined);
              }}
              placeholder={formatMessage({ id: 'projects.name' })}
              value={name}
            />
          </label>
          <span className="mt-4 mb-2 block text-sm font-medium text-foreground">{formatMessage({ id: 'projects.sourceFolder' })}</span>
          <button
            className={cn(
              'flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-border-subtle bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] p-3 text-sm text-text-secondary hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] disabled:cursor-not-allowed disabled:opacity-45',
              sourcePath && 'min-h-12 flex-row justify-start gap-2 px-3 py-0 text-start',
            )}
            disabled={isSubmitting}
            onClick={() => void pickDirectory()}
            type="button"
          >
            {sourcePath ? <Folder aria-hidden="true" className="size-4" size={20} /> : <FolderPlus aria-hidden="true" className="size-4" size={28} />}
            <span className="max-w-full truncate">{sourcePath ?? formatMessage({ id: 'projects.sourcePlaceholder' })}</span>
          </button>
          {error && <p className="mt-3 text-destructive" role="alert">{error}</p>}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button className="min-h-8 min-w-[90px] rounded-lg px-3 text-sm font-medium text-text-tertiary disabled:cursor-not-allowed disabled:opacity-45" disabled={isSubmitting} onClick={onClose} type="button">{formatMessage({ id: 'projects.cancel' })}</button>
            <button className="min-h-8 min-w-[90px] rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-45" disabled={isSubmitting} type="submit">{formatMessage({ id: isSubmitting ? isEditing ? 'projects.saving' : 'projects.creating' : isEditing ? 'projects.save' : 'projects.create' })}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
