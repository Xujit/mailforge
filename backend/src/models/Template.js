// src/models/Template.js

const { DataTypes } = require("sequelize");
const sequelize = require("../database");
const Tenant = require("./Tenant");

const Template = sequelize.define("Template", {
  // Composite natural key: tenantId + slug
  // We use a surrogate PK (auto int) and a unique constraint on [tenantId, slug]
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenantId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: Tenant, key: "id" },
  },
  // Human-readable identifier used in API calls e.g. "welcome_email"
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: /^[a-z0-9_-]+$/i,
    },
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  htmlBody: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  textBody: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "",
  },
  // Stored as JSON array string: '["first_name","product_name"]'
  variables: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: "[]",
    get() {
      const raw = this.getDataValue("variables");
      try { return JSON.parse(raw); } catch { return []; }
    },
    set(val) {
      this.setDataValue("variables", JSON.stringify(Array.isArray(val) ? val : []));
    },
  },
  sends: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: "templates",
  indexes: [
    { unique: true, fields: ["tenant_id", "slug"] },
  ],
});

Tenant.hasMany(Template, { foreignKey: "tenantId", onDelete: "CASCADE" });
Template.belongsTo(Tenant, { foreignKey: "tenantId" });

module.exports = Template;
