// src/models/MessageLog.js

const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Tenant = require("./Tenant");

const MessageLog = sequelize.define("MessageLog", {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    // e.g. msg_abc1234567
  },
  tenantId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: Tenant, key: "id" },
  },
  templateSlug: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  to: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("delivered", "failed", "pending"),
    allowNull: false,
    defaultValue: "pending",
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  previewUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  apiKeyLabel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Snapshot of variables used — stored as JSON
  variables: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "{}",
    get() {
      const raw = this.getDataValue("variables");
      try { return JSON.parse(raw); } catch { return {}; }
    },
    set(val) {
      this.setDataValue("variables", JSON.stringify(val || {}));
    },
  },
}, {
  tableName: "message_logs",
  updatedAt: false,
});

Tenant.hasMany(MessageLog, { foreignKey: "tenantId", onDelete: "CASCADE" });
MessageLog.belongsTo(Tenant, { foreignKey: "tenantId" });

module.exports = MessageLog;
