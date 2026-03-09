// src/scripts/resetDb.js — wipe and recreate all tables (dev only)
require("dotenv").config();
const { sequelize } = require("../models");

(async () => {
  console.log("⚠️  Resetting database...");
  await sequelize.sync({ force: true });
  console.log("✅  Database reset complete.");
  process.exit(0);
})();
