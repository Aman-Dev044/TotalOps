import fs from 'fs/promises';
import path from 'path';
import type { Model } from 'mongoose';
import {
  Activity, Automation, Contact, Dealer, Design, FileDoc, Film, LeadForm, Note, Package, Project, Review, Roll, Service, Staff, Store, Template,
} from './models';
import { conflict, uid } from './http';
import { logActivity } from './project';

export type Resource = {
  model: Model<any>;
  search: string[];
  sort?: Record<string, 1 | -1>;
  label: string;
  beforeCreate?: (data: any) => Promise<void> | void;
  beforeUpdate?: (data: any, id: string) => Promise<void> | void;
  beforeDelete?: (id: string) => Promise<void>;
  afterDelete?: (doc: any) => Promise<void>;
  afterCreate?: (doc: any) => Promise<void>;
};

export function storageDir() {
  const dir = process.env.STORAGE_DIR || 'storage';
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'form';
}

export const RESOURCES: Record<string, Resource> = {
  stores: {
    model: Store, label: 'Store', search: ['name', 'address', 'code'], sort: { name: 1 },
    beforeDelete: async (id) => {
      if (await Project.exists({ storeId: id })) throw conflict('This store has projects. Reassign them before deleting the store.');
      if (await Staff.exists({ storeId: id })) throw conflict('This store has team members. Move them to another store first.');
    },
  },
  staff: {
    model: Staff, label: 'Team member', search: ['name', 'title', 'skills', 'phone', 'email'], sort: { name: 1 },
    beforeDelete: async (id) => {
      if (await Project.exists({ $or: [{ 'appointments.installerId': id }, { ownerId: id }] })) {
        throw conflict('This team member has appointments or projects. Mark them inactive instead of deleting.');
      }
    },
  },
  contacts: {
    model: Contact, label: 'Contact', search: ['name', 'company', 'email', 'phone', 'address', 'tags'], sort: { createdAt: -1 },
    beforeDelete: async (id) => {
      if (await Project.exists({ contactId: id })) throw conflict('This contact has linked projects. Archive the projects instead of deleting the contact.');
    },
    afterCreate: async (doc) => logActivity('contact', 'Contact created', doc.name, undefined, '/customers'),
  },
  films: {
    model: Film, label: 'Film', search: ['name', 'brand', 'line', 'category', 'description'], sort: { tier: -1, name: 1 },
    beforeDelete: async (id) => {
      if (await Roll.exists({ filmId: id })) throw conflict('Inventory rolls use this film. Archive the rolls first or mark the film inactive.');
      if (await Project.exists({ filmId: id })) throw conflict('Projects use this film. Mark it inactive instead.');
    },
  },
  inventory: {
    model: Roll, label: 'Film roll', search: ['name', 'brand', 'batch', 'location'], sort: { name: 1 },
    beforeCreate: (d) => {
      d.movements = [{ id: uid(), type: 'received', qty: Number(d.remainingM2) || 0, note: 'Opening stock', at: new Date() }];
    },
    beforeUpdate: (d) => {
      delete d.movements; // movements only change through /api/ops/inventory/:id
    },
  },
  services: { model: Service, label: 'Service', search: ['name', 'variant', 'coverage', 'detail'], sort: { segment: 1, name: 1 } },
  packages: { model: Package, label: 'Proposal package', search: ['name', 'description'], sort: { name: 1 } },
  templates: { model: Template, label: 'Message template', search: ['name', 'body', 'subject'], sort: { name: 1 } },
  dealers: {
    model: Dealer, label: 'Dealer', search: ['name', 'contactName', 'email', 'phone'], sort: { name: 1 },
    beforeCreate: (d) => {
      d.token = uid() + uid();
    },
    beforeUpdate: (d) => {
      delete d.token;
    },
  },
  notes: {
    model: Note, label: 'Note', search: ['text', 'assignedTo', 'author'], sort: { createdAt: -1 },
    beforeCreate: (d) => {
      d.author = d.author || 'Workspace Admin';
    },
  },
  files: {
    model: FileDoc, label: 'File', search: ['name', 'category'], sort: { createdAt: -1 },
    beforeCreate: () => {
      throw conflict('Upload files with POST /api/upload');
    },
    afterDelete: async (doc) => {
      if (doc?.diskName) await fs.unlink(path.join(storageDir(), 'uploads', doc.diskName)).catch(() => undefined);
    },
  },
  activities: { model: Activity, label: 'Notification', search: ['title', 'text'], sort: { createdAt: -1 } },
  reviews: { model: Review, label: 'Review', search: ['customerName', 'quote', 'platform'], sort: { createdAt: -1 } },
  leadforms: {
    model: LeadForm, label: 'Lead form', search: ['name', 'heading', 'slug'], sort: { createdAt: -1 },
    beforeCreate: async (d) => {
      let base = slugify(d.slug || d.name || 'form');
      let slug = base;
      for (let n = 2; await LeadForm.exists({ slug }); n++) slug = `${base}-${n}`;
      d.slug = slug;
      d.submissions = [];
    },
    beforeUpdate: async (d, id) => {
      delete d.submissions;
      if (d.slug) {
        d.slug = slugify(d.slug);
        if (await LeadForm.exists({ slug: d.slug, _id: { $ne: id } })) throw conflict('That form address is already in use');
      }
    },
  },
  automations: {
    model: Automation, label: 'Automation', search: ['name', 'trigger', 'message'], sort: { createdAt: 1 },
    beforeCreate: (d) => {
      d.runs = [];
      d.firedKeys = [];
    },
    beforeUpdate: (d) => {
      delete d.runs;
      delete d.firedKeys;
    },
  },
  designs: { model: Design, label: 'Design', search: ['name', 'notes'], sort: { updatedAt: -1 } },
};

export function getResource(name: string) {
  return Object.prototype.hasOwnProperty.call(RESOURCES, name) ? RESOURCES[name] : null;
}

const RESERVED = new Set(['q', 'limit', 'skip', 'sort', 'fields', 'token']);

/** Builds a Mongo filter from query params: equality, comma lists ($in), booleans, plus ?q= text search. */
export function buildFilter(res: Resource, sp: URLSearchParams) {
  const filter: Record<string, any> = {};
  const paths = res.model.schema.paths;
  sp.forEach((raw, key) => {
    if (RESERVED.has(key) || !raw) return;
    if (!paths[key] && !key.includes('.')) return;
    const vals = raw.split(',').map((v) => (v === 'true' ? true : v === 'false' ? false : v === 'null' ? null : v));
    filter[key] = vals.length > 1 ? { $in: vals } : vals[0];
  });
  const q = sp.get('q')?.trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = res.search.map((f) => ({ [f]: rx }));
  }
  return filter;
}

export function cleanBody(data: any) {
  const out = { ...data };
  for (const k of ['_id', 'id', '__v', 'createdAt', 'updatedAt']) delete out[k];
  return out;
}
