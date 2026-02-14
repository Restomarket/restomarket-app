import { relations } from 'drizzle-orm';
import { units } from './units.schema.js';
import { vatRates } from './vat-rates.schema.js';
import { families } from './families.schema.js';
import { subfamilies } from './subfamilies.schema.js';
import { items } from './items.schema.js';
import { erpCodeMappings } from './erp-code-mappings.schema.js';

// ── Units ───────────────────────────────────────────────────────────────────

export const unitsRelations = relations(units, ({ many }) => ({
  items: many(items),
  erpCodeMappings: many(erpCodeMappings),
}));

// ── VAT Rates ───────────────────────────────────────────────────────────────

export const vatRatesRelations = relations(vatRates, ({ many }) => ({
  items: many(items),
  erpCodeMappings: many(erpCodeMappings),
}));

// ── Families ────────────────────────────────────────────────────────────────

export const familiesRelations = relations(families, ({ many }) => ({
  subfamilies: many(subfamilies),
  items: many(items),
  erpCodeMappings: many(erpCodeMappings),
}));

// ── Subfamilies ─────────────────────────────────────────────────────────────

export const subfamiliesRelations = relations(subfamilies, ({ one, many }) => ({
  family: one(families, {
    fields: [subfamilies.familyId],
    references: [families.id],
  }),
  items: many(items),
  erpCodeMappings: many(erpCodeMappings),
}));

// ── ERP Code Mappings ───────────────────────────────────────────────────────

export const erpCodeMappingsRelations = relations(erpCodeMappings, ({ one }) => ({
  unit: one(units, {
    fields: [erpCodeMappings.unitId],
    references: [units.id],
  }),
  vatRate: one(vatRates, {
    fields: [erpCodeMappings.vatRateId],
    references: [vatRates.id],
  }),
  family: one(families, {
    fields: [erpCodeMappings.familyId],
    references: [families.id],
  }),
  subfamily: one(subfamilies, {
    fields: [erpCodeMappings.subfamilyId],
    references: [subfamilies.id],
  }),
}));
