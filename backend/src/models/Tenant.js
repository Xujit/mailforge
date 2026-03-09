// src/models/Tenant.js

const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const Tenant = sequelize.define("Tenant", {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  firebaseUid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name:    { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING, allowNull: true, defaultValue: "" },
  phone:   { type: DataTypes.STRING, allowNull: true, defaultValue: "" },
  email:   { type: DataTypes.STRING, allowNull: false, unique: true },
  photoUrl:{ type: DataTypes.STRING, allowNull: true },

  // ── Approval ──────────────────────────────────────────────────────────────
  status: {
    type: DataTypes.ENUM("pending", "active", "rejected"),
    allowNull: false,
    defaultValue: "pending",
  },
  approvedAt:      { type: DataTypes.DATE,   allowNull: true },
  rejectedAt:      { type: DataTypes.DATE,   allowNull: true },
  rejectionReason: { type: DataTypes.STRING, allowNull: true },

  // ── Subscription ──────────────────────────────────────────────────────────
  // trial      → within 7-day free trial (set on approval)
  // active     → paid subscription is current
  // expired    → trial or subscription has lapsed — API access blocked
  // cancelled  → admin manually cancelled
  subscriptionStatus: {
    type: DataTypes.ENUM("trial", "active", "expired", "cancelled"),
    allowNull: false,
    defaultValue: "trial",
  },
  // When the trial ends (set to approvedAt + 7 days on approval)
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // monthly | yearly — null while on trial
  planType: {
    type: DataTypes.ENUM("monthly", "yearly"),
    allowNull: true,
  },
  // When the current paid plan expires
  planExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Track whether warning email has been sent (reset each billing cycle)
  warningEmailSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: "tenants",
});

module.exports = Tenant;
