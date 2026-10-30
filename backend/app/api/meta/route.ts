import { handler } from '@/lib/http';
import { LEGAL_RULES } from '@/lib/engine/legal';
import { BODY_TYPES, OPTIONAL_PANES } from '@/lib/engine/vehicles';
import { STAGE_LABELS, STAGE_ORDER } from '@/lib/project';
import { TRIGGERS } from '@/lib/automation';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => ({
  stages: STAGE_ORDER.map((key) => ({ key, label: STAGE_LABELS[key] })),
  segments: [
    { key: 'automotive', label: 'Automotive' },
    { key: 'residential', label: 'Residential' },
    { key: 'commercial', label: 'Commercial' },
  ],
  legalRules: LEGAL_RULES,
  bodyTypes: BODY_TYPES,
  optionalPanes: OPTIONAL_PANES,
  triggers: TRIGGERS,
  appointmentTypes: ['consultation', 'measurement', 'installation', 'site_visit', 'collection'],
  appointmentStatuses: ['scheduled', 'dispatched', 'checked_in', 'completed', 'cancelled'],
  shopStatuses: [
    { key: 'booked', label: 'Booked' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'in_bay', label: 'In Bay' },
    { key: 'installing', label: 'Installing' },
    { key: 'ready', label: 'Ready for Pickup' },
    { key: 'collected', label: 'Collected' },
  ],
  filmCategories: ['ceramic', 'crystalline', 'carbon', 'dyed', 'metallic', 'reflective', 'spectrally_selective', 'low_e', 'safety', 'frost', 'protective'],
  glassTypes: [
    { key: 'single_clear', label: 'Single clear (annealed)' },
    { key: 'single_tinted', label: 'Single body-tinted' },
    { key: 'double_glazed', label: 'Double glazed (IGU)' },
    { key: 'low_e', label: 'Low-E coated' },
    { key: 'laminated', label: 'Laminated' },
    { key: 'toughened', label: 'Toughened / tempered' },
  ],
  paymentMethods: ['Bank transfer', 'Card · external terminal', 'Cash', 'Cheque', 'Finance'],
  sources: ['Website', 'Website form', 'Google', 'Google Ads', 'Instagram', 'Facebook', 'Referral', 'Phone call', 'Walk-in', 'Dealer', 'Repeat customer', 'Direct'],
  units: ['mm', 'cm', 'm', 'in', 'ft'],
}));
