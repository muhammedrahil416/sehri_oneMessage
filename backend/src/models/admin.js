'use strict';

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define(
    'Admin',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      zone_location_id: {
        // Must reference a locations row where type = 'zone'.
        // Enforced in the controller that creates admins, not here,
        // since Sequelize validators can't easily do async lookups.
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'locations',
          key: 'id',
        },
      },
      fcm_token: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'admins',
      indexes: [
        { unique: true, fields: ['phone'] },
        { fields: ['zone_location_id'] },
      ],
      defaultScope: {
        attributes: { exclude: ['password'] },
      },
      scopes: {
        withPassword: {
          attributes: {},
        },
      },
    }
  );

  Admin.associate = (models) => {
    Admin.belongsTo(models.Location, { foreignKey: 'zone_location_id', as: 'zone' });
  };

  return Admin;
};