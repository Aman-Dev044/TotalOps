export type Id = string;
export type Segment = 'automotive' | 'residential' | 'commercial';
export type Stage = 'lead' | 'consultation' | 'measurements' | 'proposal' | 'approval' | 'scheduled' | 'in_progress' | 'invoicing' | 'closed';
export type Zone = 'windscreen' | 'frontSides' | 'rearSides' | 'rearWindscreen' | 'sunroof';

export type Store = { _id: Id; name: string; code?: string; address?: string; phone?: string; email?: string; bays: string[]; openTime: string; closeTime: string; color: string; lat?: number; lng?: number; active: boolean };
export type Staff = { _id: Id; name: string; role: string; title?: string; storeId?: Id; phone?: string; email?: string; skills: string[]; color: string; hoursPerWeek: number; rating: number; active: boolean };
export type Contact = { _id: Id; name: string; company?: string; email?: string; phone?: string; address?: string; status: string; segment: Segment; source?: string; storeId?: Id; tags: string[]; notes?: string; createdAt: string; updatedAt: string };
export type Shade = { vlt: number; tser: number; glare: number; absorptance: number };
export type Film = { _id: Id; name: string; brand?: string; line?: string; category: string; segments: Segment[]; description?: string; shades: Shade[]; irr: number; uvr: number; reflectivity: number; signalSafe: boolean; tintColor: string; thicknessMil: number; warrantyYears: number; rollWidths: number[]; costPerM2: number; sellPerM2: number; glassCompat?: Record<string, string>; tier: number; active: boolean };
export type Movement = { id: string; type: string; qty: number; note?: string; projectId?: string; projectNumber?: string; balance?: number; at: string };
export type Roll = { _id: Id; filmId?: Id; name: string; brand?: string; shade?: number; storeId?: Id; widthMm: number; lengthM: number; remainingM2: number; reorderAtM2: number; costPerM2: number; sellPerM2: number; batch?: string; location?: string; reorderPending: boolean; movements: Movement[]; archived: boolean };
export type Service = { _id: Id; name: string; variant?: string; segment: Segment; coverage?: string; detail?: string; unit: string; unitPrice: number; defaultQty: number; filmId?: Id; storeIds: Id[]; minutes: number; archived: boolean };
export type Line = { id: string; serviceId?: string; name: string; coverage?: string; detail?: string; qty: number; unitPrice: number };
export type OfferOption = { id: string; title: string; filmLabel?: string; group?: string; recommended?: boolean; detail?: string; discount?: number; comparisonPrice?: number; lines: Line[] };
export type Deposit = { mode: 'none' | 'fixed' | 'percent'; value: number };
export type Package = { _id: Id; name: string; segment: Segment; description?: string; validDays: number; taxRate: number; storeIds: Id[]; intro?: string; footer?: string; terms?: string; afterApprovalMessage?: string; nextStepLabel?: string; nextStepUrl?: string; showScope: boolean; deposit: Deposit; options: OfferOption[]; archived: boolean };
export type Template = { _id: Id; name: string; channel: 'sms' | 'email'; purpose: string; subject?: string; body: string; archived: boolean };
export type Dealer = { _id: Id; name: string; contactName?: string; phone?: string; email?: string; storeId?: Id; token: string; notes?: string; active: boolean };

export type Pane = { id: string; label: string; zone?: Zone; windowType?: string; width: number; height: number; unit: string; qty: number; filmId?: string; selected: boolean; notes?: string; glass?: string };
export type PaneGroup = { id: string; name: string; panes: Pane[]; notes?: string; glazing?: string; orientation?: string; access?: string };
export type Measurements = { groups: PaneGroup[]; verified?: boolean; measuredAt?: string; checklist?: Record<string, boolean>; photos?: string[]; notes?: string };

export type Appointment = {
  _id: Id; type: string; date: string; start: string; end: string; installerId?: Id; coInstallerIds: Id[]; storeId?: Id; bay?: string;
  location: 'in_shop' | 'on_site'; address?: string; status: 'scheduled' | 'dispatched' | 'checked_in' | 'completed' | 'cancelled';
  shopStatus: 'booked' | 'arrived' | 'in_bay' | 'installing' | 'ready' | 'collected'; dealer?: string; notes?: string; reminder: boolean; checkedInAt?: string; completedAt?: string;
};
export type Payment = { _id: Id; kind: 'deposit' | 'payment'; amount: number; method: string; date: string; reference?: string; createdAt: string };
export type Message = { _id: Id; direction: 'in' | 'out'; channel: string; body: string; from?: string; simulated: boolean; createdAt: string };
export type Proposal = {
  status: 'draft' | 'sent' | 'viewed' | 'approved'; token?: string | null; options: OfferOption[]; intro?: string; footer?: string; terms?: string; taxRate: number; validUntil: string;
  deposit: Deposit; showScope?: boolean; afterApprovalMessage?: string; nextStepLabel?: string; nextStepUrl?: string; internalSelection?: string[]; selectedOptionIds?: string[];
  approvedBy?: string; approvedAt?: string; sentAt?: string; viewedAt?: string;
};
export type InvoiceLine = { name: string; coverage?: string; option?: string; qty: number; unitPrice: number; amount: number };
export type Invoice = { number: string; issuedAt: string; dueDate: string; lines: InvoiceLine[]; subtotal: number; discount: number; tax: number; taxRate: number; total: number; terms?: string; acceptedBy?: string; status: string; sentAt?: string | null };
export type Totals = { invoiceTotal: number; paid: number; balance: number; status: 'none' | 'deposit' | 'unpaid' | 'partial' | 'paid'; proposal: null | { subtotal: number; discount: number; tax: number; total: number; deposit: number; selected: string[] }; measuredM2: number; panes: number };

export type Project = {
  _id: Id; number: string; title: string; segment: Segment; stage: Stage; stageLabel: string; storeId?: Id; ownerId?: Id; contactId?: Id; dealerId?: Id; source: string; priority: string; tags: string[]; archived: boolean;
  vehicle: { year?: string; make?: string; model?: string; bodyType?: string; color?: string; rego?: string; vin?: string; stockPo?: string };
  property: { type?: string; address?: string; glazing?: string; orientation?: string; levels?: number };
  location: { type: 'in_shop' | 'on_site'; address?: string };
  reference?: string; requirements?: string; filmId?: Id; filmShade?: number; measurements: Measurements; appointments: Appointment[];
  install: { status: 'pending' | 'in_progress' | 'complete'; checkedInAt?: string; completedAt?: string };
  proposal: Proposal | null; invoice: Invoice | null; payments: Payment[]; messages: Message[]; value: number; designId?: Id; closedAt?: string; createdAt: string; updatedAt: string;
  contact: Contact | null; store: Store | null; owner: Staff | null; film: Film | null; nextAppointment: (Appointment & { installer: string | null }) | null; totals: Totals;
};
export type Note = { _id: Id; kind: 'note' | 'task' | 'reply'; text: string; projectId?: Id; assignedTo?: string; dueDate?: string; done: boolean; author?: string; tags: string[]; createdAt: string };
export type FileDoc = { _id: Id; name: string; size: number; mime: string; category: string; projectId?: Id; archived: boolean; createdAt: string };
export type Activity = { _id: Id; type: string; title: string; text?: string; projectId?: Id; link?: string; read: boolean; createdAt: string };
export type ProjectDetail = Project & { notes: Note[]; files: FileDoc[]; activity: Activity[] };

export type ScheduleItem = Appointment & {
  projectId: Id; projectNumber: string; projectTitle: string; segment: Segment; stage: Stage; stageLabel: string; value: number; priority: string; tags: string[];
  vehicle: Project['vehicle']; property: Project['property']; panes: number; filmShade?: number; film: Pick<Film, '_id' | 'name' | 'brand' | 'category' | 'tintColor'> | null;
  contact: Pick<Contact, '_id' | 'name' | 'phone' | 'email' | 'company' | 'address'> | null; installer: Pick<Staff, '_id' | 'name' | 'color' | 'storeId' | 'title'> | null;
  coInstallers: Pick<Staff, '_id' | 'name' | 'color'>[]; store: Pick<Store, '_id' | 'name' | 'color' | 'address' | 'phone'> | null; dealerName: string;
};

export type LegalRule = { code: string; name: string; hemisphere: 'south' | 'north'; frontSideMin: number; rearSideMin: number; rearWindscreenMin: number; windscreen: string; windscreenStripPct: number; tolerance: number; notes: string };
export type BodyType = { key: string; label: string; examples: string; privacyRearCommon: boolean; panes: { key: string; label: string; zone: Zone; width: number; height: number; qty: number; minutes: number }[] };
export type Meta = {
  stages: { key: Stage; label: string }[]; segments: { key: Segment; label: string }[]; legalRules: LegalRule[]; bodyTypes: BodyType[];
  optionalPanes: BodyType['panes']; triggers: { key: string; label: string; timed?: boolean }[]; appointmentTypes: string[]; appointmentStatuses: string[];
  shopStatuses: { key: string; label: string }[]; filmCategories: string[]; glassTypes: { key: string; label: string }[]; paymentMethods: string[]; sources: string[]; units: string[];
};
export type Settings = {
  business: { name: string; email?: string; phone?: string; address?: string; abn?: string; taxRate: number; taxLabel?: string; currency: string; website?: string; logoUrl?: string };
  region: string;
  defaults: { labourRate?: number; chargeOutRate?: number; electricityRate?: number; trimMm?: number; validDays?: number; depositPercent?: number; terms?: string; invoiceDueDays?: number };
  measurementProfiles: Record<string, { title: string; groupLabel: string; unit: string; dimensions: boolean; sections: string[] }>;
  roles: { key: string; name: string; description?: string; protected?: boolean; permissions: any; stores?: string[] }[];
};
