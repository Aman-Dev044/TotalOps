'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/components/providers';
import { Avatar, Button, Card, CardHeader, Field, Input, Progress } from '@/components/ui';
import { TabIntro } from './shared';

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export function AccountTab() {
  const { admin, refresh } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (admin) setProfile({ name: admin.name || '', email: admin.email || '', phone: admin.phone || '' });
  }, [admin]);

  const saveProfile = async () => {
    if (!profile.name.trim()) return toast.error('Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return toast.error('Enter a valid email address');
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', profile);
      await refresh();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  };
  const savePw = async () => {
    if (!pw.currentPassword) return toast.error('Enter your current password');
    if (pw.newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (pw.newPassword !== pw.confirm) return toast.error('New passwords do not match');
    setSavingPw(true);
    try {
      await api.patch('/auth/me', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingPw(false);
    }
  };
  const s = strength(pw.newPassword);

  return (
    <div>
      <TabIntro title="Your account" text="The administrator account is the only login for this workspace." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={UserRound} title="Profile" />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={profile.name} size={52} />
              <div>
                <p className="font-semibold">{profile.name || 'Administrator'}</p>
                <p className="text-sm text-muted-fg">Owner / administrator</p>
              </div>
            </div>
            <Field label="Name">
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </Field>
            <Field label="Sign-in email">
              <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Button icon={Save} loading={savingProfile} onClick={saveProfile}>
              Save profile
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader icon={KeyRound} title="Change password" subtitle="Minimum 8 characters." />
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              savePw();
            }}
          >
            <Field label="Current password">
              <Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </Field>
            <Field label="New password">
              <Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </Field>
            {pw.newPassword ? (
              <div>
                <Progress value={s} max={5} tone={s <= 2 ? 'danger' : s <= 3 ? 'warning' : 'success'} height={6} />
                <p className="mt-1 text-xs text-muted-fg">{['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][s]}</p>
              </div>
            ) : null}
            <Field label="Confirm new password" error={pw.confirm && pw.confirm !== pw.newPassword ? 'Passwords do not match' : undefined}>
              <Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <Button type="submit" icon={KeyRound} loading={savingPw}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
