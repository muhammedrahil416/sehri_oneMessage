'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('polls', 'assigned_rider_id', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: {
        model: 'riders',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      // If a rider is deleted, clear the assignment rather than blocking delete.
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('polls', ['assigned_rider_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('polls', 'assigned_rider_id');
  },
};
