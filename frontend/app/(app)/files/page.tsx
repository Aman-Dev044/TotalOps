'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download, File as FileIcon, FileSpreadsheet, FileText, FolderOpen, Grid3x3, Image as ImageIcon, List, Trash2, UploadCloud, Box } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, mediaUrl, uploadFile } from '@/lib/api';
import { useApi, useLocalState } from '@/lib/hooks';
import { fileSize, timeAgo } from '@/lib/format';
import type { FileDoc, Project } from '@/lib/types';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Progress, SearchInput, Segmented, Select, Stagger, StaggerItem, cn, useConfirm } from '@/components/ui';

const CATEGORIES = ['photo', 'document', 'measurement', 'quote', 'form', 'design', 'other'];
const MAX = 15 * 1024 * 1024;

const isImage = (f: FileDoc) => f.mime?.startsWith('image/') && f.mime !== 'image/svg+xml';
const iconFor = (f: FileDoc) => (isImage(f) ? ImageIcon : f.mime === 'application/pdf' ? FileText : /sheet|csv/.test(f.mime) ? FileSpreadsheet : f.mime === 'model/gltf-binary' ? Box : FileIcon);

export default function FilesPage() {
  const { data, error, isLoading, mutate } = useApi<FileDoc[]>('/files');
  const { data: projects } = useApi<Project[]>('/projects?archived=all');
  const confirm = useConfirm();
  const [view, setView] = useLocalState<'grid' | 'list'>('files.view', 'grid');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [uploadProject, setUploadProject] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<FileDoc | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const projectOf = (id?: string) => projects?.find((p) => p._id === id);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || [])
      .filter((f) => !f.archived)
      .filter((f) => (!category || f.category === category) && (!projectFilter || (projectFilter === '_none' ? !f.projectId : f.projectId === projectFilter)))
      .filter((f) => !s || [f.name, f.category, projectOf(f.projectId)?.number].some((x) => (x || '').toLowerCase().includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, category, projectFilter, projects]);

  const totalSize = (data || []).reduce((s, f) => s + (f.size || 0), 0);

  const upload = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    const tooBig = arr.filter((f) => f.size > MAX);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')} exceed the 15 MB limit`);
    const ok = arr.filter((f) => f.size <= MAX);
    if (!ok.length) return;
    setProgress({ done: 0, total: ok.length });
    let success = 0;
    for (const f of ok) {
      try {
        await uploadFile(f, { projectId: uploadProject || undefined, category: uploadCategory || (f.type.startsWith('image/') ? 'photo' : 'document') });
        success++;
      } catch (err) {
        toast.error(`${f.name}: ${errorMessage(err)}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    if (success) toast.success(`${success} file${success > 1 ? 's' : ''} uploaded`);
    mutate();
  };

  const remove = async (f: FileDoc) => {
    if (!(await confirm({ title: `Delete ${f.name}?`, description: 'The file is removed permanently from storage.', confirmLabel: 'Delete file', danger: true }))) return;
    try {
      await api.del(`/files/${f._id}`);
      toast.success('File deleted');
      if (preview?._id === f._id) setPreview(null);
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        eyebrow="Operations"
        title="Files & photos"
        subtitle={`Quotes, forms, measurement photos and documents · ${(data || []).length} files · ${fileSize(totalSize)}`}
        actions={
          <Segmented
            options={[
              { key: 'grid', label: <Grid3x3 className="h-4 w-4" aria-label="Grid view" /> },
              { key: 'list', label: <List className="h-4 w-4" aria-label="List view" /> },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />

      <Card className="mb-6 p-4">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Field label="Attach uploads to project">
            <Select value={uploadProject} onChange={(e) => setUploadProject(e.target.value)}>
              <option value="">No project (workspace file)</option>
              {(projects || []).filter((p) => !p.archived).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.number} · {p.contact?.name || p.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              <option value="">Automatic (photo / document)</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files);
          }}
          onClick={() => !progress && input.current?.click()}
          animate={{ scale: drag ? 1.01 : 1 }}
          className={cn('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-primary bg-primary/5' : 'border-line hover:border-primary/50 hover:bg-muted/40')}
        >
          <motion.span animate={{ y: drag ? -4 : 0 }} className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <UploadCloud className="h-6 w-6" />
          </motion.span>
          {progress ? (
            <div className="w-full max-w-xs">
              <p className="mb-2 text-sm font-semibold">
                Uploading {progress.done}/{progress.total}…
              </p>
              <Progress value={progress.done} max={progress.total} />
            </div>
          ) : (
            <>
              <p className="font-semibold">Drop files here or click to upload</p>
              <p className="mt-1 text-xs text-muted-fg">Images, PDF, text, CSV, Word, Excel or GLB · maximum 15 MB each</p>
            </>
          )}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,.docx,.xlsx,.glb"
            onChange={(e) => {
              if (e.target.files) upload(e.target.files);
              e.target.value = '';
            }}
          />
        </motion.div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search files…" className="w-full sm:w-72" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40" aria-label="Category filter">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </Select>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-56" aria-label="Project filter">
          <option value="">All project files</option>
          <option value="_none">Workspace files (no project)</option>
          {(projects || []).map((p) => (
            <option key={p._id} value={p._id}>
              {p.number} · {p.contact?.name || p.title}
            </option>
          ))}
        </Select>
        <p className="ml-auto text-xs text-muted-fg">{list.length} shown</p>
      </div>

      {isLoading && !data ? (
        <PageLoader />
      ) : !list.length ? (
        <Card>
          <EmptyState icon={FolderOpen} title="No files yet" description="Upload a file with the drop zone above — attach it to a project to see it on the job card." />
        </Card>
      ) : view === 'grid' ? (
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {list.map((f) => {
            const Icon = iconFor(f);
            const project = projectOf(f.projectId);
            return (
              <StaggerItem key={f._id}>
                <motion.div whileHover={{ y: -3 }} className="card group overflow-hidden">
                  <button type="button" onClick={() => setPreview(f)} className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
                    {isImage(f) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(f._id)} alt={f.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted-fg">
                        <Icon className="h-10 w-10" />
                      </span>
                    )}
                    <span className="absolute left-2 top-2">
                      <Badge className="bg-card/90 backdrop-blur">{f.category}</Badge>
                    </span>
                  </button>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold" title={f.name}>
                      {f.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-fg">
                      {fileSize(f.size)} · {timeAgo(f.createdAt)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      {project ? (
                        <Link href={`/projects/${project._id}`} className="truncate text-[11px] font-semibold text-primary hover:underline">
                          {project.number}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted-fg">Workspace</span>
                      )}
                      <span className="flex gap-0.5">
                        <a href={mediaUrl(f._id, true)} aria-label="Download file" className="rounded-md p-1 text-muted-fg hover:bg-muted hover:text-fg">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button type="button" aria-label="Delete file" onClick={() => remove(f)} className="rounded-md p-1 text-muted-fg hover:bg-danger/10 hover:text-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Project</th>
                <th>Size</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((f) => {
                const Icon = iconFor(f);
                const project = projectOf(f.projectId);
                return (
                  <tr key={f._id}>
                    <td>
                      <button type="button" onClick={() => setPreview(f)} className="flex items-center gap-2.5 text-left hover:text-primary">
                        {isImage(f) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaUrl(f._id)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-fg">
                            <Icon className="h-4 w-4" />
                          </span>
                        )}
                        <span className="max-w-[320px] truncate font-semibold">{f.name}</span>
                      </button>
                    </td>
                    <td>
                      <Badge>{f.category}</Badge>
                    </td>
                    <td>{project ? <Link href={`/projects/${project._id}`} className="text-primary hover:underline">{project.number}</Link> : <span className="text-muted-fg">—</span>}</td>
                    <td className="text-xs">{fileSize(f.size)}</td>
                    <td className="text-xs text-muted-fg">{timeAgo(f.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <a href={mediaUrl(f._id, true)}>
                          <Button size="xs" variant="ghost" icon={Download}>
                            Download
                          </Button>
                        </a>
                        <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => remove(f)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <PreviewModal file={preview} onClose={() => setPreview(null)} onDelete={remove} project={preview ? projectOf(preview.projectId) : undefined} />
    </div>
  );
}

function PreviewModal({ file, onClose, onDelete, project }: { file: FileDoc | null; onClose: () => void; onDelete: (f: FileDoc) => void; project?: Project }) {
  const [text, setText] = useState<string | null>(null);
  const isText = !!file && /^text\//.test(file.mime);
  useEffect(() => {
    setText(null);
    if (!file || !isText) return;
    let alive = true;
    fetch(mediaUrl(file._id))
      .then((r) => r.text())
      .then((t) => alive && setText(t.slice(0, 50_000)))
      .catch(() => alive && setText('Could not load this file.'));
    return () => {
      alive = false;
    };
  }, [file, isText]);

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      size="xl"
      title={file?.name}
      description={file ? `${file.category} · ${fileSize(file.size)}${project ? ` · ${project.number}` : ''}` : ''}
      footer={
        file ? (
          <>
            <Button variant="ghost" icon={Trash2} className="mr-auto text-danger" onClick={() => onDelete(file)}>
              Delete
            </Button>
            <a href={mediaUrl(file._id, true)}>
              <Button icon={Download}>Download file</Button>
            </a>
          </>
        ) : null
      }
    >
      {file ? (
        isImage(file) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(file._id)} alt={file.name} className="mx-auto max-h-[70vh] rounded-xl object-contain" />
        ) : file.mime === 'application/pdf' ? (
          <iframe src={mediaUrl(file._id)} title={file.name} className="h-[70vh] w-full rounded-xl border border-line" />
        ) : isText ? (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-xs">{text ?? 'Loading…'}</pre>
        ) : (
          <EmptyState icon={FileIcon} title="Preview unavailable for this file type" description="Use Download to open it locally." />
        )
      ) : null}
    </Modal>
  );
}
