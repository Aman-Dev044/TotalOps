import { CarFront, Building2, Home } from 'lucide-react';
import { APPT_STATUS, PAYMENT_STATUS, PROPOSAL_STATUS, SEGMENT_META, SHOP_STATUS, stageMeta } from '@/lib/format';
import type { Segment } from '@/lib/types';
import { Badge, cn } from './ui';

export const SEGMENT_ICON = { automotive: CarFront, residential: Home, commercial: Building2 } as const;

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const m = stageMeta(stage);
  return (
    <span className={cn('chip border', className)} style={{ color: m.hex, borderColor: `${m.hex}55`, background: `${m.hex}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.hex }} />
      {m.label}
    </span>
  );
}

export function SegmentBadge({ segment, className }: { segment: Segment; className?: string }) {
  const m = SEGMENT_META[segment] || SEGMENT_META.automotive;
  const Icon = SEGMENT_ICON[segment] || CarFront;
  return (
    <span className={cn('chip', m.bg, m.color, className)}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

export const ApptStatusBadge = ({ status }: { status: string }) => <Badge tone={APPT_STATUS[status]?.tone || 'neutral'} dot>{APPT_STATUS[status]?.label || status}</Badge>;
export const ShopStatusBadge = ({ status }: { status: string }) => <Badge tone={SHOP_STATUS[status]?.tone || 'neutral'} dot>{SHOP_STATUS[status]?.label || status}</Badge>;
export const ProposalStatusBadge = ({ status }: { status: string }) => <Badge tone={PROPOSAL_STATUS[status]?.tone || 'neutral'}>{PROPOSAL_STATUS[status]?.label || status}</Badge>;
export const PaymentStatusBadge = ({ status }: { status: string }) => <Badge tone={PAYMENT_STATUS[status]?.tone || 'neutral'}>{PAYMENT_STATUS[status]?.label || status}</Badge>;
