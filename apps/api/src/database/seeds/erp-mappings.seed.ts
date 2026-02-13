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
 * EBP vendor mappings (vendorId: 971a1d7b-8cd4-41d9-925f-f658deb6efa5)
 * Generated from item-mapping.json — 103 records covering unit, vat, family, subfamily.
 */
export const ebpMappings = {
  vendorId: '971a1d7b-8cd4-41d9-925f-f658deb6efa5',
  mappings: [
    // Units (39)
    { mappingType: 'unit', erpCode: '', restoCode: 'unit_piece_rm', restoLabel: 'Default Unit' },
    { mappingType: 'unit', erpCode: 'GR', restoCode: 'unit_g_rm', restoLabel: 'GRAMME' },
    { mappingType: 'unit', erpCode: 'KG', restoCode: 'unit_kg_rm', restoLabel: 'KILOGRAMME' },
    { mappingType: 'unit', erpCode: 'TNE', restoCode: 'unit_t_rm', restoLabel: 'TONNE' },
    { mappingType: 'unit', erpCode: 'L', restoCode: 'unit_l_rm', restoLabel: 'LITRE' },
    { mappingType: 'unit', erpCode: 'ML', restoCode: 'unit_ml_rm', restoLabel: 'millilitre' },
    { mappingType: 'unit', erpCode: 'CL', restoCode: 'unit_cl_rm', restoLabel: 'CENTILiTRE' },
    { mappingType: 'unit', erpCode: 'PCS', restoCode: 'unit_piece_rm', restoLabel: 'PIECES' },
    { mappingType: 'unit', erpCode: 'U', restoCode: 'unit_piece_rm', restoLabel: 'UNITE' },
    {
      mappingType: 'unit',
      erpCode: 'BC',
      restoCode: 'unit_box_rm',
      restoLabel: 'BOITE DE CONSERVE',
    },
    {
      mappingType: 'unit',
      erpCode: 'BT',
      restoCode: 'unit_box_rm',
      restoLabel: 'BOITE DE CONSERVE',
    },
    { mappingType: 'unit', erpCode: 'BOIT', restoCode: 'unit_box_rm', restoLabel: 'BOITE' },
    {
      mappingType: 'unit',
      erpCode: 'BCV',
      restoCode: 'unit_jar_glass_rm',
      restoLabel: 'BOCAUX EN VERRE',
    },
    { mappingType: 'unit', erpCode: 'BCL', restoCode: 'unit_jar_rm', restoLabel: 'BOCALE' },
    {
      mappingType: 'unit',
      erpCode: 'BOCP',
      restoCode: 'unit_jar_plastic_rm',
      restoLabel: 'BOCAUX EN PLASTIQUE',
    },
    {
      mappingType: 'unit',
      erpCode: 'BDM',
      restoCode: 'unit_can_metal_rm',
      restoLabel: 'BIDON METALIQUE',
    },
    {
      mappingType: 'unit',
      erpCode: 'BDP',
      restoCode: 'unit_can_plastic_rm',
      restoLabel: 'BIDON EN PLASTIQUE',
    },
    { mappingType: 'unit', erpCode: 'BLC', restoCode: 'unit_block_rm', restoLabel: 'BLOC' },
    { mappingType: 'unit', erpCode: 'BOL', restoCode: 'unit_ball_rm', restoLabel: 'BOULE' },
    { mappingType: 'unit', erpCode: 'BRQ', restoCode: 'unit_tray_rm', restoLabel: 'BARQUETTE' },
    { mappingType: 'unit', erpCode: 'BTL', restoCode: 'unit_bottle_rm', restoLabel: 'BOUTEILLE' },
    { mappingType: 'unit', erpCode: 'CNT', restoCode: 'unit_can_rm', restoLabel: 'CANETTE' },
    {
      mappingType: 'unit',
      erpCode: 'COLP',
      restoCode: 'unit_package_plastic_rm',
      restoLabel: 'COLIS EN PLASTIQUE',
    },
    { mappingType: 'unit', erpCode: 'CRT', restoCode: 'unit_carton_rm', restoLabel: 'CARTON' },
    { mappingType: 'unit', erpCode: 'FLC', restoCode: 'unit_flask_rm', restoLabel: 'FLACON' },
    { mappingType: 'unit', erpCode: 'POT', restoCode: 'unit_pot_rm', restoLabel: 'POTS' },
    { mappingType: 'unit', erpCode: 'PQT', restoCode: 'unit_pack_rm', restoLabel: 'PAQUET' },
    { mappingType: 'unit', erpCode: 'RL', restoCode: 'unit_roll_rm', restoLabel: 'ROULEAUX' },
    { mappingType: 'unit', erpCode: 'SAC', restoCode: 'unit_bag_rm', restoLabel: 'SACS' },
    { mappingType: 'unit', erpCode: 'SACH', restoCode: 'unit_sachet_rm', restoLabel: 'SACHET' },
    { mappingType: 'unit', erpCode: 'SEAU', restoCode: 'unit_bucket_rm', restoLabel: 'SEAUX' },
    { mappingType: 'unit', erpCode: 'SOV', restoCode: 'unit_vacuum_rm', restoLabel: 'SOUS VIDE' },
    {
      mappingType: 'unit',
      erpCode: 'TEPK',
      restoCode: 'unit_tetrapack_rm',
      restoLabel: 'TETRAPACK',
    },
    {
      mappingType: 'unit',
      erpCode: 'TETB',
      restoCode: 'unit_upside_down_rm',
      restoLabel: 'TETE EN BAS',
    },
    { mappingType: 'unit', erpCode: 'TR', restoCode: 'unit_slice_rm', restoLabel: 'TRANCHES' },
    { mappingType: 'unit', erpCode: 'PLT', restoCode: 'unit_pallet_rm', restoLabel: 'PALETTE' },
    { mappingType: 'unit', erpCode: 'TCH', restoCode: 'unit_touch_rm', restoLabel: 'TOUCHE' },
    { mappingType: 'unit', erpCode: 'HEUR', restoCode: 'unit_hour_rm', restoLabel: 'Heures' },
    { mappingType: 'unit', erpCode: 'JOUR', restoCode: 'unit_day_rm', restoLabel: 'Jours' },

    // VAT (22 — both integer and decimal string formats for EBP CAST(Rate AS VARCHAR))
    { mappingType: 'vat', erpCode: '0', restoCode: 'vat_0_rm', restoLabel: 'EXO / 0%' },
    { mappingType: 'vat', erpCode: '0.00', restoCode: 'vat_0_rm', restoLabel: 'EXO / 0%' },
    { mappingType: 'vat', erpCode: '7', restoCode: 'vat_7_rm', restoLabel: 'Taux réduit 7%' },
    { mappingType: 'vat', erpCode: '7.00', restoCode: 'vat_7_rm', restoLabel: 'Taux réduit 7%' },
    { mappingType: 'vat', erpCode: '8', restoCode: 'vat_8_rm', restoLabel: 'Taux réduit 8%' },
    { mappingType: 'vat', erpCode: '8.00', restoCode: 'vat_8_rm', restoLabel: 'Taux réduit 8%' },
    { mappingType: 'vat', erpCode: '9', restoCode: 'vat_9_rm', restoLabel: 'TAUX 9%' },
    { mappingType: 'vat', erpCode: '9.00', restoCode: 'vat_9_rm', restoLabel: 'TAUX 9%' },
    { mappingType: 'vat', erpCode: '10', restoCode: 'vat_10_rm', restoLabel: 'Taux réduit 10%' },
    { mappingType: 'vat', erpCode: '10.00', restoCode: 'vat_10_rm', restoLabel: 'Taux réduit 10%' },
    { mappingType: 'vat', erpCode: '12', restoCode: 'vat_12_rm', restoLabel: 'TAUX 12%' },
    { mappingType: 'vat', erpCode: '12.00', restoCode: 'vat_12_rm', restoLabel: 'TAUX 12%' },
    { mappingType: 'vat', erpCode: '13', restoCode: 'vat_13_rm', restoLabel: 'Taux réduit 13%' },
    { mappingType: 'vat', erpCode: '13.00', restoCode: 'vat_13_rm', restoLabel: 'Taux réduit 13%' },
    { mappingType: 'vat', erpCode: '14', restoCode: 'vat_14_rm', restoLabel: 'Taux réduit 14%' },
    { mappingType: 'vat', erpCode: '14.00', restoCode: 'vat_14_rm', restoLabel: 'Taux réduit 14%' },
    { mappingType: 'vat', erpCode: '16', restoCode: 'vat_16_rm', restoLabel: 'TAUX 16%' },
    { mappingType: 'vat', erpCode: '16.00', restoCode: 'vat_16_rm', restoLabel: 'TAUX 16%' },
    { mappingType: 'vat', erpCode: '18', restoCode: 'vat_18_rm', restoLabel: 'TAUX 18%' },
    { mappingType: 'vat', erpCode: '18.00', restoCode: 'vat_18_rm', restoLabel: 'TAUX 18%' },
    { mappingType: 'vat', erpCode: '20', restoCode: 'vat_20_rm', restoLabel: 'Taux normal 20%' },
    { mappingType: 'vat', erpCode: '20.00', restoCode: 'vat_20_rm', restoLabel: 'Taux normal 20%' },

    // Families (7)
    {
      mappingType: 'family',
      erpCode: 'FAM00001',
      restoCode: 'cat_fresh',
      restoLabel: 'Produits Frais',
    },
    {
      mappingType: 'family',
      erpCode: 'FAM00002',
      restoCode: 'cat_frozen',
      restoLabel: 'Produits Surgelés',
    },
    {
      mappingType: 'family',
      erpCode: 'FAM00003',
      restoCode: 'cat_beverages',
      restoLabel: 'Boissons',
    },
    {
      mappingType: 'family',
      erpCode: 'FAM00004',
      restoCode: 'cat_grocery',
      restoLabel: 'Epicerie',
    },
    {
      mappingType: 'family',
      erpCode: 'FAM00005',
      restoCode: 'cat_non_food',
      restoLabel: 'Produits non-alimentaires',
    },
    {
      mappingType: 'family',
      erpCode: 'FAM00006',
      restoCode: 'cat_dairy',
      restoLabel: 'PRODUIT LAITIER',
    },
    { mappingType: 'family', erpCode: 'FAM00007', restoCode: 'cat_others', restoLabel: 'AUTRES' },

    // Subfamilies (35)
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00001',
      restoCode: 'subcat_fresh_fruits_vegetables',
      restoLabel: 'Fruits et Légumes Frais',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00002',
      restoCode: 'subcat_fresh_meat_fish',
      restoLabel: 'Viandes et Poissons Frais',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00003',
      restoCode: 'subcat_creamery',
      restoLabel: 'Crémerie',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00004',
      restoCode: 'subcat_delicatessen',
      restoLabel: 'Charcuterie et Produits Traiteur',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00005',
      restoCode: 'subcat_frozen_fruits_vegetables',
      restoLabel: 'Fruits et Légumes Surgelés',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00006',
      restoCode: 'subcat_frozen_meat_fish',
      restoLabel: 'Viandes et Poissons Surgelés',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00007',
      restoCode: 'subcat_frozen_desserts',
      restoLabel: 'Desserts et Produits Traiteur Surgelés',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00008',
      restoCode: 'subcat_frozen_bakery',
      restoLabel: 'Boulangerie Surgelés',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00009',
      restoCode: 'subcat_soft_drinks',
      restoLabel: 'Boissons Non-Alcoolisées',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00010',
      restoCode: 'subcat_coffee_tea',
      restoLabel: 'Cafés, Thés et Infusions',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00011',
      restoCode: 'subcat_juice_nectars',
      restoLabel: 'Jus et Nectars',
    },
    { mappingType: 'subfamily', erpCode: 'SFM00012', restoCode: 'subcat_water', restoLabel: 'Eau' },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00013',
      restoCode: 'subcat_pasta_rice',
      restoLabel: 'Pâtes, Riz et Nouilles',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00014',
      restoCode: 'subcat_canned',
      restoLabel: 'Conserves et Bocaux',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00015',
      restoCode: 'subcat_cereals_grains',
      restoLabel: 'Céréales et Grains',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00016',
      restoCode: 'subcat_spreads',
      restoLabel: 'Tartinables',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00017',
      restoCode: 'subcat_spices',
      restoLabel: 'Epices et Assaisonnements',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00018',
      restoCode: 'subcat_vinegars_oils',
      restoLabel: 'Vinaigres et Huiles',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00019',
      restoCode: 'subcat_sauces_condiments',
      restoLabel: 'Sauces et Condiments',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00020',
      restoCode: 'subcat_broths_stocks',
      restoLabel: 'Bouillons et Fonds',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00021',
      restoCode: 'subcat_biscuits_snacks',
      restoLabel: 'Biscuits et Snacks',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00022',
      restoCode: 'subcat_chocolate',
      restoLabel: 'Chocolat et Couverture',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00023',
      restoCode: 'subcat_flours_mix',
      restoLabel: 'Farines et Mix',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00024',
      restoCode: 'subcat_pastry_aids',
      restoLabel: 'Aide à la Patisserie',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00025',
      restoCode: 'subcat_sugar_sweeteners',
      restoLabel: 'Sucre et Edulcorants',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00026',
      restoCode: 'subcat_bakery',
      restoLabel: 'Boulangerie',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00027',
      restoCode: 'subcat_paper_consumables',
      restoLabel: 'Papier et Consommables',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00028',
      restoCode: 'subcat_cleaning_hygiene',
      restoLabel: 'Produits de Nettoyage et Hygiène',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00029',
      restoCode: 'subcat_packaging',
      restoLabel: 'Emballages et Conditionnement',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00030',
      restoCode: 'subcat_equipment_utensils',
      restoLabel: 'Equipement et Ustensiles',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00031',
      restoCode: 'subcat_bases_mix',
      restoLabel: 'BASES & MIX',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00032',
      restoCode: 'subcat_seaweed_dried_leaves',
      restoLabel: 'Algues et feuilles sechées',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00033',
      restoCode: 'subcat_creamery_eggs',
      restoLabel: 'Crémerie & oeufs',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00034',
      restoCode: 'subcat_cheese',
      restoLabel: 'Fromages',
    },
    {
      mappingType: 'subfamily',
      erpCode: 'SFM00035',
      restoCode: 'subcat_pallets',
      restoLabel: 'PALETTES',
    },
  ],
};
