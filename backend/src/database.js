// src/database.js — Sequelize + SQLite connection

const { Sequelize } = require("sequelize");
const path = require("path");

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "../data/mailforge.sqlite");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: process.env.NODE_ENV === "development"
    ? (msg) => console.log(`[SQL] ${msg}`)
    : false,
  define: {
    // Use snake_case column names automatically
    underscored: true,
    // Add createdAt / updatedAt to every model
    timestamps: true,
  },
});

module.exports = sequelize;
