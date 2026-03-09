// src/models/ApiKey.js

const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Tenant = require("./Tenant");

const ApiKey = sequelize.define("ApiKey", {
  key: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: Tenant, key: "id" },
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Stored as JSON string: '["send","templates"]'
  scopes: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '["send"]',
    get() {
      const raw = this.getDataValue("scopes");
      try { return JSON.parse(raw); } catch { return []; }
    },
    set(val) {
      this.setDataValue("scopes", JSON.stringify(Array.isArray(val) ? val : [val]));
    },
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  lastUsed: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: "api_keys",
});

Tenant.hasMany(ApiKey, { foreignKey: "tenantId", onDelete: "CASCADE" });
ApiKey.belongsTo(Tenant, { foreignKey: "tenantId" });

module.exports = ApiKey;
