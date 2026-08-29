'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('poll_responses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      poll_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'polls',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      response: {
        type: Sequelize.ENUM('yes', 'no'),
        allowNull: false,
      },
      // Snapshot of user's zone at the moment of voting.
      zone: {
        type: Sequelize.ENUM('masjid', 'boys_hostel', 'stanza', 'girls'),
        allowNull: false,
      },
      is_special_case: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      special_case_type: {
        type: Sequelize.ENUM('want', 'dont_want'),
        allowNull: true,
      },
      special_case_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sehri_allowed: {
        type: Sequelize.ENUM('approved', 'rejected'),
        allowNull: true,
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

    // One vote per user per poll — DB-level guarantee.
    await queryInterface.addIndex('poll_responses', ['poll_id', 'user_id'], { unique: true });
    await queryInterface.addIndex('poll_responses', ['poll_id']);
    await queryInterface.addIndex('poll_responses', ['user_id']);
    // Zone-grouped count queries hit this composite index.
    await queryInterface.addIndex('poll_responses', ['poll_id', 'zone']);
    // Super admin special-cases list filters by poll + flag.
    await queryInterface.addIndex('poll_responses', ['poll_id', 'is_special_case']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('poll_responses');
  },
};
