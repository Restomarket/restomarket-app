/**
 * ERP Mappings Seed Script
 *
 * Example mappings for common ERP systems.
 * To use: POST this data to /api/admin/mappings/seed
 *
 * Usage:
 * ```bash
 * curl -X POST http://localhost:3000/api/admin/mappings/seed \
 *   -H "Content-Type: application/json" \
 *   -H "X-API-Key: your-api-key" \
 *   -d @apps/api/src/database/seeds/erp-mappings.seed.json
 * ```
 */

export const exampleMappings = {
  vendorId: 'vendor-example',
  mappings: [
    // Unit mappings
    { mappingType: 'unit', erpCode: 'KG', restoCode: 'kilogram', restoLabel: 'Kilogramme' },
    { mappingType: 'unit', erpCode: 'L', restoCode: 'liter', restoLabel: 'Litre' },
    { mappingType: 'unit', erpCode: 'PC', restoCode: 'piece', restoLabel: 'Pièce' },
    { mappingType: 'unit', erpCode: 'G', restoCode: 'gram', restoLabel: 'Gramme' },
    { mappingType: 'unit', erpCode: 'ML', restoCode: 'milliliter', restoLabel: 'Millilitre' },
    { mappingType: 'unit', erpCode: 'BOX', restoCode: 'box', restoLabel: 'Boîte' },
    { mappingType: 'unit', erpCode: 'BT', restoCode: 'bottle', restoLabel: 'Bouteille' },
    { mappingType: 'unit', erpCode: 'BAG', restoCode: 'bag', restoLabel: 'Sac' },

    // VAT mappings (France)
    { mappingType: 'vat', erpCode: 'TVA20', restoCode: 'vat_20', restoLabel: 'TVA 20%' },
    { mappingType: 'vat', erpCode: 'TVA10', restoCode: 'vat_10', restoLabel: 'TVA 10%' },
    { mappingType: 'vat', erpCode: 'TVA5.5', restoCode: 'vat_5_5', restoLabel: 'TVA 5.5%' },
    { mappingType: 'vat', erpCode: 'TVA2.1', restoCode: 'vat_2_1', restoLabel: 'TVA 2.1%' },
    { mappingType: 'vat', erpCode: 'TVA0', restoCode: 'vat_0', restoLabel: 'TVA 0%' },

    // Family mappings
    {
      mappingType: 'family',
      erpCode: 'FRUITS',
      restoCode: 'fresh_produce',
      restoLabel: 'Fruits & Légumes',
    },
    {
      mappingType: 'family',
      erpCode: 'LEGUMES',
      restoCode: 'fresh_produce',
      restoLabel: 'Fruits & Légumes',
    },
    {
      mappingType: 'family',
      erpCode: 'VIANDE',
      restoCode: 'meat_poultry',
      restoLabel: 'Viandes & Volailles',
    },
    {
      mappingType: 'family',
      erpCode: 'POISSON',
      restoCode: 'fish_seafood',
      restoLabel: 'Poissons & Fruits de mer',
    },
    {
      mappingType: 'family',
      erpCode: 'LAITIER',
      restoCode: 'dairy',
      restoLabel: 'Produits laitiers',
    },
    {
      mappingType: 'family',
      erpCode: 'EPICERIE',
      restoCode: 'dry_goods',
      restoLabel: 'Épicerie sèche',
    },

    // Subfamily mappings
    { mappingType: 'subfamily', erpCode: 'POMME', restoCode: 'apples', restoLabel: 'Pommes' },
    { mappingType: 'subfamily', erpCode: 'TOMATE', restoCode: 'tomatoes', restoLabel: 'Tomates' },
    { mappingType: 'subfamily', erpCode: 'BOEUF', restoCode: 'beef', restoLabel: 'Bœuf' },
    { mappingType: 'subfamily', erpCode: 'POULET', restoCode: 'chicken', restoLabel: 'Poulet' },
    { mappingType: 'subfamily', erpCode: 'SAUMON', restoCode: 'salmon', restoLabel: 'Saumon' },
  ],
};

/**
 * Sage-specific mappings
 */
export const sageMappings = {
  vendorId: 'vendor-sage',
  mappings: [
    { mappingType: 'unit', erpCode: 'U', restoCode: 'piece', restoLabel: 'Pièce' },
    { mappingType: 'unit', erpCode: 'KGM', restoCode: 'kilogram', restoLabel: 'Kilogramme' },
    { mappingType: 'unit', erpCode: 'LTR', restoCode: 'liter', restoLabel: 'Litre' },
    { mappingType: 'vat', erpCode: '1', restoCode: 'vat_20', restoLabel: 'TVA 20%' },
    { mappingType: 'vat', erpCode: '2', restoCode: 'vat_10', restoLabel: 'TVA 10%' },
    { mappingType: 'vat', erpCode: '3', restoCode: 'vat_5_5', restoLabel: 'TVA 5.5%' },
  ],
};

/**
 * EBP-specific mappings
 */
export const ebpMappings = {
  vendorId: 'vendor-ebp',
  mappings: [
    { mappingType: 'unit', erpCode: 'PIECE', restoCode: 'piece', restoLabel: 'Pièce' },
    { mappingType: 'unit', erpCode: 'KILO', restoCode: 'kilogram', restoLabel: 'Kilogramme' },
    { mappingType: 'unit', erpCode: 'LITRE', restoCode: 'liter', restoLabel: 'Litre' },
    { mappingType: 'vat', erpCode: 'N', restoCode: 'vat_20', restoLabel: 'TVA 20%' },
    { mappingType: 'vat', erpCode: 'R', restoCode: 'vat_10', restoLabel: 'TVA 10%' },
    { mappingType: 'vat', erpCode: 'S', restoCode: 'vat_5_5', restoLabel: 'TVA 5.5%' },
  ],
};
