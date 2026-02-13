#!/usr/bin/env node
/**
 * Transform Convex item_mapping export → SeedErpMappingsDto format
 *
 * Usage:
 *   node scripts/transform-convex-mappings.js item-mapping.json > mappings-seed.json
 *
 * Then seed via the API (with app running):
 *   curl -X POST http://localhost:3000/api/admin/mappings/seed \
 *     -H "X-API-Key: $API_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d @mappings-seed.json
 */

const fs = require('fs');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node transform-convex-mappings.js <input.json>');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Group by vendorId, skip entries with empty erpCode
const byVendor = {};
for (const m of input) {
  if (!m.erpCode || m.erpCode.trim() === '') continue;
  if (!byVendor[m.vendorId]) byVendor[m.vendorId] = [];
  byVendor[m.vendorId].push({
    mappingType: m.mappingType,
    erpCode: m.erpCode,
    restoCode: m.restoCode,
    restoLabel: m.restoLabel,
  });
}

const vendors = Object.keys(byVendor);
if (vendors.length === 0) {
  console.error('No valid mappings found');
  process.exit(1);
}

if (vendors.length === 1) {
  // Single vendor — output directly as SeedErpMappingsDto
  console.log(
    JSON.stringify(
      {
        vendorId: vendors[0],
        mappings: byVendor[vendors[0]],
      },
      null,
      2,
    ),
  );
} else {
  // Multiple vendors — output array
  console.log(
    JSON.stringify(
      vendors.map(v => ({ vendorId: v, mappings: byVendor[v] })),
      null,
      2,
    ),
  );
}

// Print summary to stderr
const total = Object.values(byVendor).reduce((sum, arr) => sum + arr.length, 0);
const byType = {};
for (const mappings of Object.values(byVendor)) {
  for (const m of mappings) {
    byType[m.mappingType] = (byType[m.mappingType] || 0) + 1;
  }
}
process.stderr.write(
  `Transformed ${total} mappings from ${vendors.length} vendor(s)\n` +
    Object.entries(byType)
      .map(([type, count]) => `  ${type}: ${count}`)
      .join('\n') +
    '\n',
);
