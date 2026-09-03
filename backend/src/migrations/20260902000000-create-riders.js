'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('riders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // The zone this rider is assigned to serve.
      // Null means they serve all zones (super-rider).
      zone_location_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'locations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Optional link to a users row.
      // When set, the rider JWT carries user_id so they can vote, chat etc.
      // without a second login — identical to the admin/super_admin pattern.
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // Live GPS coordinates — updated by the rider app every 5 seconds.
      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      // Human-readable address string sent by the rider app
      // (reverse-geocoded on the device, not on the server).
      current_address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Estimated minutes until delivery at current position.
      // Set by the rider app, displayed to residents.
      eta_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      // idle        = logged in but not yet delivering
      // delivering  = actively out with food
      // done        = today's delivery complete
      status: {
        type: Sequelize.ENUM('idle', 'delivering', 'done'),
        defaultValue: 'idle',
      },
      // Super admin toggles this to put a rider on/off duty.
      // Off-duty riders cannot be assigned and are hidden from the user map.
      is_active: {
        type: Sequelize.BOOLEAN,
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

    await queryInterface.addIndex('riders', ['phone'], { unique: true });
    await queryInterface.addIndex('riders', ['zone_location_id']);
    await queryInterface.addIndex('riders', ['is_active']);
    await queryInterface.addIndex('riders', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('riders');
  },
};
