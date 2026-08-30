'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('prayer_timings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        unique: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Bangalore',
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'India',
      },
      // Full timings from AlAdhan or local adhan library, stored as JSON blob.
      timings: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      tahajjud_time: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      imsak_time: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      date_hijri: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_from_api: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('prayer_timings', ['date'], { unique: true });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('prayer_timings');
  },
};
