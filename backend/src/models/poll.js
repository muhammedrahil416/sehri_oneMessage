'use strict';

module.exports = (sequelize, DataTypes) => {
  const Poll = sequelize.define(
    'Poll',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // The calendar date this poll is collecting votes *for* (the Sehri date).
      // Format: YYYY-MM-DD. One poll per day — enforced by unique index.
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
      },
      question: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'Will you be having Sehri food?',
      },
      // Master on/off switch. The phase utility reads the current IST hour
      // to determine the phase, but this flag lets the super admin override
      // and force-close (or force-open) the poll outside the normal schedule.
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Only set when the super admin uses PATCH /active/toggle to manually
      // override the schedule. When set, the phase utility respects this
      // time instead of computing from the IST clock. Null = automatic.
      deadline_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // The rider assigned by the super admin to deliver for this poll day.
      // Set between 6–10 PM after the allotment window closes.
      // Null = not yet assigned.
      assigned_rider_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'riders',
          key: 'id',
        },
      },
    },
    {
      tableName: 'polls',
      indexes: [
        { unique: true, fields: ['date'] },
        { fields: ['is_active'] },
      ],
    }
  );

  Poll.associate = (models) => {
    Poll.hasMany(models.PollResponse, {
      foreignKey: 'poll_id',
      as: 'responses',
    });
    Poll.belongsTo(models.Rider, {
      foreignKey: 'assigned_rider_id',
      as: 'assigned_rider',
    });
  };

  return Poll;
};
