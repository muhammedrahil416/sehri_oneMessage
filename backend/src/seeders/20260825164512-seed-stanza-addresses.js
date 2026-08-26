'use strict';

const { randomUUID } = require('crypto');

const STANZA_ZONE_ID = 'b95acebb-ec91-4c21-bbbb-d96f658e5885';

const ADDRESS_NAMES = [
  '888 7th Stage 11th Cross Road Mylasandra Kings and Queens PG',
  'Stanza Living (Cordoba)',
  'Target PG',
  'RR Luxury PG',
  'Krishna Villa Apartments',
  'Balaji PG for Gents',
  'Lasya PG',
  'Shiva Sai PG',
  'Stanza Living (Huelva House)',
  'Global Vista',
  'SS Luxury PG',
  'Good Lands PG',
  'Millenial Blue Opal',
  'Paras Global Kutir',
  'Others',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const rows = ADDRESS_NAMES.map((name) => ({
      id: randomUUID(),
      name,
      type: 'address',
      parent_id: STANZA_ZONE_ID,
      is_active: true,
      // created_at / updated_at are DEFAULT_GENERATED CURRENT_TIMESTAMP in the DB,
      // so we deliberately omit them here rather than guessing camelCase vs snake_case.
    }));

    await queryInterface.bulkInsert('locations', rows, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('locations', {
      type: 'address',
      parent_id: STANZA_ZONE_ID,
    }, {});
  },
};