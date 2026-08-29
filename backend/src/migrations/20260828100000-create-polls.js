'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('polls', {
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
      question: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: 'Will you be having Sehri food?',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Set by super admin's manual toggle. Null = automatic schedule.
      deadline_time: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('polls', ['date'], { unique: true });
    await queryInterface.addIndex('polls', ['is_active']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('polls');
  },
};
