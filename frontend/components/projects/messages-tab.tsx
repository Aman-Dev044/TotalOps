'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Mail, MessageSquare, Reply, Send, Smartphone } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { fmtDateTime } from '@/lib/format';
import type { Template } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Select, Textarea, cn } from '@/components/ui';
import type { TabProps } from './use-project-action';

export function MessagesTab({ p, run, busy }: TabProps) {
  const { data: templates } = useApi<Template[]>('/templates');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [p.messages.length]);

  const send = async () => {
    if (!body.trim()) return;
    const ok = await run('message.send', { body, channel }, 'Message queued (simulated — nothing was sent)');
    if (ok) setBody('');
  };

  return (
    <Card>
      <CardHeader icon={MessageSquare} title={`Message history (${p.messages.length})`} subtitle={`To: ${p.contact?.name || 'customer'} ${p.contact?.phone ? `· ${p.contact.phone}` : ''} · Simulation only — no SMS or email is sent.`} />
      <div className="max-h-[520px] min-h-[260px] space-y-3 overflow-y-auto bg-muted/30 p-5">
        {!p.messages.length ? <p className="py-10 text-center text-sm text-muted-fg">No messages yet. Pick a template or type a message below.</p> : null}
        <AnimatePresence initial={false}>
          {p.messages.map((m) => {
            const out = m.direction === 'out';
            const auto = (m.from || '').startsWith('Automation');
            return (
              <motion.div key={m._id} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', out ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-line bg-card')}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={cn('mt-1 flex items-center gap-1.5 text-[10px]', out ? 'text-white/70' : 'text-muted-fg')}>
                    {m.channel === 'email' ? <Mail className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                    {auto ? <Bot className="h-3 w-3" /> : null}
                    {m.from || (out ? 'You' : 'Customer')} · {fmtDateTime(m.createdAt)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={end} />
      </div>
      <div className="space-y-2 border-t border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as 'sms' | 'email')} className="h-9 w-28" aria-label="Channel">
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>
          <Select
            value=""
            onChange={(e) => {
              const t = templates?.find((x) => x._id === e.target.value);
              if (t) {
                setBody(t.body);
                setChannel(t.channel);
              }
            }}
            className="h-9 w-auto min-w-[200px]"
            aria-label="Use a canned message"
          >
            <option value="">Use a canned message…</option>
            {(templates || []).filter((t) => !t.archived).map((t) => <option key={t._id} value={t._id}>{t.name} ({t.channel})</option>)}
          </Select>
          <Badge tone="info">Variables like {'{{first_name}}'} fill in automatically</Badge>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={`New ${channel.toUpperCase()} to ${p.contact?.name || 'customer'}…`} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" icon={Reply} loading={busy === 'message.reply'} onClick={() => run('message.reply', {}, 'Customer reply simulated')}>Simulate customer reply</Button>
          <Button icon={Send} loading={busy === 'message.send'} disabled={!body.trim()} onClick={send}>Send {channel.toUpperCase()}</Button>
        </div>
      </div>
    </Card>
  );
}
