'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Download, FileText, FolderOpen, ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { api, errorMessage, mediaUrl, uploadFile } from '@/lib/api';
import { refresh } from '@/lib/hooks';
import { fileSize, timeAgo } from '@/lib/format';
import type { FileDoc } from '@/lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Select, cn, useConfirm } from '@/components/ui';
import type { TabProps } from './use-project-action';

export function FilesTab({ p, reload }: TabProps) {
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('photo');
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<FileDoc | null>(null);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(list.length);
    let ok = 0;
    for (const f of list) {
      try {
        await uploadFile(f, { projectId: p._id, category: f.type.startsWith('image/') ? category : category === 'photo' ? 'document' : category });
        ok++;
      } catch (err) {
        toast.error(`${f.name}: ${errorMessage(err)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (ok) toast.success(`${ok} file${ok > 1 ? 's' : ''} attached to project`);
    await reload();
    refresh('/files');
  };

  const remove = async (f: FileDoc) => {
    if (!(await confirm({ title: `Delete ${f.name}?`, description: 'The file is removed from storage.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.del(`/files/${f._id}`);
      toast.success('File deleted');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader
        icon={FolderOpen}
        title="Documents & photos"
        subtitle="Add quotes, forms, photos and other files (max 15 MB each)."
        actions={
          <>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto" aria-label="Category">
              <option value="photo">Photo</option>
              <option value="before">Before photo</option>
              <option value="after">After photo</option>
              <option value="document">Document</option>
              <option value="measurement">Measurement photo</option>
            </Select>
            <Button icon={Upload} loading={uploading > 0} onClick={() => input.current?.click()}>Upload</Button>
          </>
        }
      />
      <input ref={input} type="file" multiple hidden accept="image/*,.pdf,.txt,.csv,.docx,.xlsx" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
      <div
        className={cn('m-5 rounded-2xl border-2 border-dashed p-4 transition', drag ? 'border-primary bg-primary/5' : 'border-line')}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
      >
        {!p.files.length ? (
          <EmptyState icon={Upload} title="Drop files here" description="Or use Upload. Photos preview inline; documents can be downloaded." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence>
              {p.files.map((f, i) => {
                const img = f.mime.startsWith('image/') && f.mime !== 'image/svg+xml';
                return (
                  <motion.div key={f._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="group overflow-hidden rounded-xl border border-line bg-card">
                    <button type="button" onClick={() => setPreview(f)} className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(f._id)} alt={f.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <span className="grid h-full place-items-center text-muted-fg"><FileText className="h-10 w-10" /></span>
                      )}
                    </button>
                    <div className="p-2">
                      <p className="truncate text-xs font-semibold" title={f.name}>{f.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <Badge>{f.category}</Badge>
                        <span className="text-[10px] text-muted-fg">{fileSize(f.size)} · {timeAgo(f.createdAt)}</span>
                      </div>
                      <div className="mt-1.5 flex gap-1">
                        <a href={mediaUrl(f._id, true)} className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-semibold text-muted-fg hover:bg-muted hover:text-fg"><Download className="h-3 w-3" />Download</a>
                        <button type="button" aria-label="Delete file" onClick={() => remove(f)} className="rounded-md px-2 py-1 text-muted-fg hover:bg-muted hover:text-danger"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
      <AnimatePresence>
        {preview ? (
          <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreview(null)}>
            <button type="button" aria-label="Close preview" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
            {preview.mime.startsWith('image/') && preview.mime !== 'image/svg+xml' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <motion.img initial={{ scale: 0.95 }} animate={{ scale: 1 }} src={mediaUrl(preview._id)} alt={preview.name} className="max-h-[88vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            ) : (
              <div className="rounded-2xl bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
                <ImageIcon className="mx-auto h-10 w-10 text-muted-fg" />
                <p className="mt-2 font-semibold">{preview.name}</p>
                <p className="text-sm text-muted-fg">Preview unavailable for this file type.</p>
                <a href={mediaUrl(preview._id, true)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4" />Download file</a>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}
