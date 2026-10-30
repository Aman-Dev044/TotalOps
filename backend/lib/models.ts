import mongoose, { Schema, Model } from 'mongoose';

const { Mixed, ObjectId } = Schema.Types;
const opts = { timestamps: true, minimize: false };

/** Untyped schema factory — mongoose's definition inference is very expensive for the TS compiler. */
function schema(definition: Record<string, unknown>, options?: Record<string, unknown>): Schema {
  return new Schema(definition as any, options as any);
}

function model<T = any>(name: string, s: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, s as any);
}

export const SEGMENTS = ['automotive', 'residential', 'commercial'] as const;
export const STAGES = ['lead', 'consultation', 'measurements', 'proposal', 'approval', 'scheduled', 'in_progress', 'invoicing', 'closed'] as const;

/* ---------- Admin (only role that can sign in) ---------- */
export const Admin = model(
  'Admin',
  schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true },
      phone: String,
      lastLoginAt: Date,
    },
    opts,
  ),
);

/* ---------- Workspace settings (singleton) ---------- */
export const Settings = model(
  'Settings',
  schema(
    {
      key: { type: String, default: 'workspace', unique: true },
      business: { type: Mixed, default: {} },
      region: { type: String, default: 'AU-WA' },
      defaults: { type: Mixed, default: {} },
      measurementProfiles: { type: Mixed, default: {} },
      roles: { type: Mixed, default: [] },
    },
    opts,
  ),
);

/* ---------- Stores / branches ---------- */
export const Store = model(
  'Store',
  schema(
    {
      name: { type: String, required: true, trim: true },
      code: { type: String, trim: true },
      address: String,
      phone: String,
      email: String,
      bays: { type: [String], default: ['Bay 1', 'Bay 2', 'Mobile Bay'] },
      openTime: { type: String, default: '08:00' },
      closeTime: { type: String, default: '16:00' },
      color: { type: String, default: '#6366f1' },
      lat: Number,
      lng: Number,
      active: { type: Boolean, default: true },
    },
    opts,
  ),
);

/* ---------- Team members (installers, sales, office) — they do not log in ---------- */
export const Staff = model(
  'Staff',
  schema(
    {
      name: { type: String, required: true, trim: true },
      role: { type: String, default: 'installer' },
      title: String,
      storeId: { type: ObjectId, ref: 'Store' },
      phone: String,
      email: String,
      skills: { type: [String], default: [] },
      color: { type: String, default: '#0ea5e9' },
      hoursPerWeek: { type: Number, default: 38 },
      rating: { type: Number, default: 4.8 },
      active: { type: Boolean, default: true },
    },
    opts,
  ),
);

/* ---------- Contacts / customers ---------- */
export const Contact = model(
  'Contact',
  schema(
    {
      name: { type: String, required: true, trim: true },
      company: String,
      email: { type: String, trim: true, lowercase: true },
      phone: String,
      address: String,
      status: { type: String, default: 'prospect' },
      segment: { type: String, default: 'automotive' },
      source: { type: String, default: 'Direct' },
      storeId: { type: ObjectId, ref: 'Store' },
      tags: { type: [String], default: [] },
      notes: String,
    },
    opts,
  ),
);

/* ---------- Film products (catalogue used by advisor, visualizer & inventory) ---------- */
export const Film = model(
  'Film',
  schema(
    {
      name: { type: String, required: true, trim: true },
      brand: String,
      line: String,
      category: { type: String, default: 'ceramic' },
      segments: { type: [String], default: ['automotive'] },
      description: String,
      shades: { type: Mixed, default: [] }, // [{ vlt, tser, glare, absorptance }]
      irr: { type: Number, default: 0 },
      uvr: { type: Number, default: 99 },
      reflectivity: { type: Number, default: 0.08 },
      signalSafe: { type: Boolean, default: true },
      tintColor: { type: String, default: '#15181d' },
      thicknessMil: { type: Number, default: 1.5 },
      warrantyYears: { type: Number, default: 10 },
      rollWidths: { type: [Number], default: [1524] },
      costPerM2: { type: Number, default: 20 },
      sellPerM2: { type: Number, default: 90 },
      glassCompat: { type: Mixed, default: {} },
      tier: { type: Number, default: 2 },
      active: { type: Boolean, default: true },
    },
    opts,
  ),
);

/* ---------- Inventory film rolls ---------- */
export const Roll = model(
  'Roll',
  schema(
    {
      filmId: { type: ObjectId, ref: 'Film' },
      name: { type: String, required: true },
      brand: String,
      shade: Number,
      storeId: { type: ObjectId, ref: 'Store' },
      widthMm: { type: Number, default: 1524 },
      lengthM: { type: Number, default: 30 },
      remainingM2: { type: Number, default: 0 },
      reorderAtM2: { type: Number, default: 10 },
      costPerM2: { type: Number, default: 0 },
      sellPerM2: { type: Number, default: 0 },
      batch: String,
      location: String,
      reorderPending: { type: Boolean, default: false },
      movements: { type: Mixed, default: [] },
      archived: { type: Boolean, default: false },
    },
    opts,
  ),
);

/* ---------- Service catalogue ---------- */
export const Service = model(
  'Service',
  schema(
    {
      name: { type: String, required: true, trim: true },
      variant: String,
      segment: { type: String, default: 'automotive' },
      coverage: String,
      detail: String,
      unit: { type: String, default: 'each' },
      unitPrice: { type: Number, default: 0 },
      defaultQty: { type: Number, default: 1 },
      filmId: { type: ObjectId, ref: 'Film' },
      storeIds: { type: [ObjectId], default: [] },
      minutes: { type: Number, default: 60 },
      archived: { type: Boolean, default: false },
    },
    opts,
  ),
);

/* ---------- Proposal packages (templates) ---------- */
export const Package = model(
  'Package',
  schema(
    {
      name: { type: String, required: true, trim: true },
      segment: { type: String, default: 'automotive' },
      description: String,
      validDays: { type: Number, default: 30 },
      taxRate: { type: Number, default: 10 },
      storeIds: { type: [ObjectId], default: [] },
      intro: String,
      footer: String,
      terms: String,
      afterApprovalMessage: String,
      nextStepLabel: String,
      nextStepUrl: String,
      showScope: { type: Boolean, default: true },
      deposit: { type: Mixed, default: { mode: 'percent', value: 50 } },
      options: { type: Mixed, default: [] },
      archived: { type: Boolean, default: false },
    },
    opts,
  ),
);

/* ---------- Message templates ---------- */
export const Template = model(
  'Template',
  schema(
    {
      name: { type: String, required: true, trim: true },
      channel: { type: String, default: 'sms' },
      purpose: { type: String, default: 'general' },
      subject: String,
      body: { type: String, default: '' },
      archived: { type: Boolean, default: false },
    },
    opts,
  ),
);

/* ---------- Dealer / fleet accounts (live dealer portal) ---------- */
export const Dealer = model(
  'Dealer',
  schema(
    {
      name: { type: String, required: true, trim: true },
      contactName: String,
      phone: String,
      email: String,
      storeId: { type: ObjectId, ref: 'Store' },
      token: { type: String, index: true },
      notes: String,
      active: { type: Boolean, default: true },
    },
    opts,
  ),
);

/* ---------- Projects (the operational core) ---------- */
const AppointmentSchema = schema(
  {
    type: { type: String, default: 'installation' }, // consultation | measurement | installation | site_visit | collection
    date: { type: String, required: true }, // YYYY-MM-DD (store local)
    start: { type: String, required: true }, // HH:mm
    end: { type: String, required: true },
    installerId: { type: ObjectId, ref: 'Staff' },
    coInstallerIds: { type: [ObjectId], default: [] },
    storeId: { type: ObjectId, ref: 'Store' },
    bay: String,
    location: { type: String, default: 'in_shop' },
    address: String,
    status: { type: String, default: 'scheduled' }, // scheduled | dispatched | checked_in | completed | cancelled
    shopStatus: { type: String, default: 'booked' }, // booked | arrived | in_bay | installing | ready | collected
    dealer: String,
    notes: String,
    reminder: { type: Boolean, default: true },
    checkedInAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

const PaymentSchema = schema(
  {
    kind: { type: String, default: 'payment' }, // deposit | payment
    amount: { type: Number, required: true },
    method: { type: String, default: 'Bank transfer' },
    date: { type: String, required: true },
    reference: String,
  },
  { timestamps: true },
);

const MessageSchema = schema(
  {
    direction: { type: String, default: 'out' },
    channel: { type: String, default: 'sms' },
    body: { type: String, required: true },
    from: String,
    simulated: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Project = model(
  'Project',
  schema(
    {
      number: { type: String, unique: true },
      title: { type: String, required: true, trim: true },
      segment: { type: String, default: 'automotive' },
      stage: { type: String, default: 'lead' },
      storeId: { type: ObjectId, ref: 'Store' },
      ownerId: { type: ObjectId, ref: 'Staff' },
      contactId: { type: ObjectId, ref: 'Contact' },
      dealerId: { type: ObjectId, ref: 'Dealer' },
      source: { type: String, default: 'Direct' },
      priority: { type: String, default: 'normal' },
      tags: { type: [String], default: [] },
      archived: { type: Boolean, default: false },
      vehicle: { type: Mixed, default: {} },
      property: { type: Mixed, default: {} },
      location: { type: Mixed, default: { type: 'in_shop', address: '' } },
      reference: String,
      requirements: String,
      filmId: { type: ObjectId, ref: 'Film' },
      filmShade: Number,
      measurements: { type: Mixed, default: { groups: [], verified: false } },
      appointments: { type: [AppointmentSchema], default: [] },
      install: { type: Mixed, default: { status: 'pending' } },
      proposal: { type: Mixed, default: null },
      invoice: { type: Mixed, default: null },
      payments: { type: [PaymentSchema], default: [] },
      messages: { type: [MessageSchema], default: [] },
      value: { type: Number, default: 0 },
      designId: { type: ObjectId, ref: 'Design' },
      closedAt: Date,
    },
    opts,
  ),
);

/* ---------- Notes & tasks ---------- */
export const Note = model(
  'Note',
  schema(
    {
      kind: { type: String, default: 'note' }, // note | task | reply
      text: { type: String, required: true },
      projectId: { type: ObjectId, ref: 'Project' },
      assignedTo: String,
      dueDate: String,
      done: { type: Boolean, default: false },
      author: String,
      tags: { type: [String], default: [] },
    },
    opts,
  ),
);

/* ---------- Files / uploads (binary kept on disk) ---------- */
export const FileDoc = model(
  'File',
  schema(
    {
      name: { type: String, required: true },
      size: Number,
      mime: String,
      category: { type: String, default: 'document' },
      projectId: { type: ObjectId, ref: 'Project' },
      diskName: String,
      archived: { type: Boolean, default: false },
    },
    opts,
  ),
);

/* ---------- Activity feed / notifications ---------- */
export const Activity = model(
  'Activity',
  schema(
    {
      type: { type: String, default: 'info' },
      title: { type: String, required: true },
      text: String,
      projectId: { type: ObjectId, ref: 'Project' },
      link: String,
      read: { type: Boolean, default: false },
    },
    opts,
  ),
);

/* ---------- Reviews ---------- */
export const Review = model(
  'Review',
  schema(
    {
      projectId: { type: ObjectId, ref: 'Project' },
      customerName: String,
      rating: { type: Number, default: 5 },
      quote: String,
      platform: { type: String, default: 'Google' },
      status: { type: String, default: 'draft' }, // draft | queued | sent | published
      log: { type: Mixed, default: [] },
    },
    opts,
  ),
);

/* ---------- Lead capture forms ---------- */
export const LeadForm = model(
  'LeadForm',
  schema(
    {
      name: { type: String, required: true },
      slug: { type: String, unique: true },
      heading: String,
      intro: String,
      fields: { type: [String], default: ['Name', 'Email', 'Phone', 'Address', 'Scope'] },
      segment: { type: String, default: 'automotive' },
      storeId: { type: ObjectId, ref: 'Store' },
      active: { type: Boolean, default: true },
      submissions: { type: Mixed, default: [] },
    },
    opts,
  ),
);

/* ---------- Automations ---------- */
export const Automation = model(
  'Automation',
  schema(
    {
      name: { type: String, required: true },
      trigger: { type: String, required: true },
      delayHours: { type: Number, default: 0 },
      action: { type: String, default: 'send_message' }, // send_message | create_task
      channel: { type: String, default: 'sms' },
      templateId: { type: ObjectId, ref: 'Template' },
      message: String,
      enabled: { type: Boolean, default: true },
      runs: { type: Mixed, default: [] },
      firedKeys: { type: [String], default: [] },
    },
    opts,
  ),
);

/* ---------- Saved 3D visualizer designs ---------- */
export const Design = model(
  'Design',
  schema(
    {
      name: { type: String, required: true },
      projectId: { type: ObjectId, ref: 'Project' },
      contactId: { type: ObjectId, ref: 'Contact' },
      config: { type: Mixed, default: {} },
      photoFileId: { type: ObjectId, ref: 'File' },
      snapshotFileId: { type: ObjectId, ref: 'File' },
      ai: { type: Mixed, default: null },
      notes: String,
    },
    opts,
  ),
);

/* ---------- Counters for human-friendly numbers ---------- */
export const Counter = model(
  'Counter',
  schema({ _id: String, seq: { type: Number, default: 0 } }),
);

export async function nextSeq(name: string, start = 1000) {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return start + (doc as any).seq;
}
