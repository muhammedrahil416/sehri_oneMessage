'use strict';

module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define(
    'Location',
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
      type: {
        type: DataTypes.ENUM('city', 'area', 'zone'),
        allowNull: false,
      },
      parent_id: {
        type: DataTypes.UUID,
        allowNull: true, // NULL only for type='city' (top of chain)
        references: {
          model: 'locations',
          key: 'id',
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'locations',
      indexes: [
        { fields: ['parent_id'] },
        { fields: ['type'] },
      ],
      validate: {
        // Enforces the hierarchy shape at the model level, in addition to the FK.
        parentRequiredUnlessCity() {
          if (this.type !== 'city' && !this.parent_id) {
            throw new Error(`A location of type '${this.type}' must have a parent_id.`);
          }
          if (this.type === 'city' && this.parent_id) {
            throw new Error(`A location of type 'city' cannot have a parent_id.`);
          }
        },
      },
    }
  );

  Location.associate = (models) => {
    // Self-referencing chain: a location has one parent, and many children
    Location.belongsTo(Location, { as: 'parent', foreignKey: 'parent_id' });
    Location.hasMany(Location, { as: 'children', foreignKey: 'parent_id' });

    // A zone-level location can have many users
    Location.hasMany(models.User, { foreignKey: 'location_id', as: 'users' });
  };

  return Location;
};
