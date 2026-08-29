'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE locations MODIFY COLUMN type ENUM('city','area','zone','address') NOT NULL;"
    );
  },

  async down(queryInterface, Sequelize) {
    // Reverting requires no 'address' rows to exist first
    await queryInterface.sequelize.query(
      "ALTER TABLE locations MODIFY COLUMN type ENUM('city','area','zone') NOT NULL;"
    );
  },
};