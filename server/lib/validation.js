// Input validation schemas (Zod). Every write endpoint validates against
// these, so bad data can never reach the database.

import { z } from 'zod';

// ── Reusable primitives ──────────────────────────────────────────────────────

const trimmed = (min, max, label) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be under ${max} characters.`);

export const emailField = z
  .string({ required_error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .min(5, 'Email is required.')
  .max(200, 'That email is too long.')
  .email('Enter a valid email address.');

/// Deliberately permissive — accepts +256 700 123456, 0700-123-456, (077) 12345.
export const phoneField = z
  .string({ required_error: 'Phone number is required.' })
  .trim()
  .min(7, 'Enter a valid phone number.')
  .max(32, 'That phone number is too long.')
  .regex(/^[+()\d\s.-]+$/, 'Phone numbers may only contain digits, spaces and + ( ) - .');

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.');

// ── Public: lead capture ─────────────────────────────────────────────────────

export const leadCreateSchema = z
  .object({
    type: z.enum(['QUOTE', 'CONTACT']).default('QUOTE'),
    name: trimmed(2, 120, 'Full name'),
    email: emailField,
    phone: phoneField,
    location: z.string().trim().max(120).optional().or(z.literal('')),
    serviceId: z.string().trim().max(64).optional().or(z.literal('')),
    projectType: z.string().trim().max(120).optional().or(z.literal('')),
    budgetRange: z.string().trim().max(60).optional().or(z.literal('')),
    timeline: z.string().trim().max(60).optional().or(z.literal('')),
    message: trimmed(10, 4000, 'Message'),
    consent: z.coerce.boolean().optional(),
    // Honeypot: real users never fill this hidden field in.
    website: z.string().max(0, 'Submission rejected.').optional().or(z.literal('')),
  })
  .transform((data) => {
    const clean = { ...data };
    for (const key of ['location', 'serviceId', 'projectType', 'budgetRange', 'timeline']) {
      if (!clean[key]) delete clean[key];
    }
    delete clean.consent;
    delete clean.website;
    return clean;
  });

export const subscribeSchema = z.object({ email: emailField });

// ── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.').max(200),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(200)
      .regex(/[a-z]/, 'Include a lowercase letter.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/\d/, 'Include a number.'),
  })
  .strict();

// ── Admin: users ─────────────────────────────────────────────────────────────

export const userCreateSchema = z.object({
  name: trimmed(2, 120, 'Name'),
  email: emailField,
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
  role: z.enum(['OWNER', 'ADMIN', 'VIEWER']).default('ADMIN'),
});

export const userUpdateSchema = z
  .object({
    name: trimmed(2, 120, 'Name').optional(),
    role: z.enum(['OWNER', 'ADMIN', 'VIEWER']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(10, 'Use at least 10 characters.').max(200).optional(),
  })
  .strict();

// ── Admin: leads ─────────────────────────────────────────────────────────────

export const leadUpdateSchema = z
  .object({
    status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTED', 'WON', 'LOST']).optional(),
    priority: z.coerce.number().int().min(0).max(5).optional(),
    assignedTo: z.string().trim().max(120).nullable().optional(),
    contactedAt: z.coerce.date().nullable().optional(),
    convertedAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const leadNoteSchema = z.object({ body: trimmed(1, 4000, 'Note') });
export const leadBulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Select at least one lead.').max(200),
  action: z.enum(['status', 'delete']),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTED', 'WON', 'LOST']).optional(),
});

// ── Admin: content ───────────────────────────────────────────────────────────

export const CATEGORIES = [
  'KITCHENS',
  'WARDROBES',
  'MEDIA_WALLS',
  'OFFICE_FITOUT',
  'CEILINGS',
  'BATHROOMS',
  'TILING',
  'FURNITURE',
  'PAINTING',
  'RENOVATION',
];

export const projectSchema = z.object({
  slug: slugField.optional(),
  title: trimmed(3, 160, 'Title'),
  category: z.enum(CATEGORIES),
  location: trimmed(2, 120, 'Location'),
  year: z.coerce.number().int().min(1990).max(2100),
  summary: trimmed(10, 400, 'Summary'),
  description: z.string().trim().max(6000).optional().or(z.literal('')),
  coverImage: trimmed(1, 500, 'Cover image'),
  featured: z.coerce.boolean().default(false),
  published: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  images: z
    .array(z.object({ url: trimmed(1, 500, 'Image URL'), alt: z.string().trim().max(200).default('') }))
    .max(60)
    .optional(),
});

export const serviceSchema = z.object({
  slug: slugField.optional(),
  title: trimmed(2, 120, 'Title'),
  tagline: trimmed(4, 200, 'Tagline'),
  description: trimmed(10, 4000, 'Description'),
  icon: z.string().trim().max(40).default('sparkle'),
  features: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  priceFrom: z.string().trim().max(60).optional().or(z.literal('')),
  coverImage: z.string().trim().max(500).optional().or(z.literal('')),
  published: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const testimonialSchema = z.object({
  name: trimmed(2, 120, 'Name'),
  role: trimmed(2, 160, 'Role'),
  quote: trimmed(10, 1000, 'Quote'),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  published: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const settingsSchema = z.record(z.string().min(1).max(80), z.any());
