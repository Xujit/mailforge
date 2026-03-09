// src/index.js — MailForge v4.1 (Firebase Auth + Sequelize + SQLite + Subscriptions)

require("dotenv").config();

const path = require("path");
const fs   = require("fs");

const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

require("./firebase").getFirebaseApp();

const express = require("express");
const { sequelize } = require("./models");
const { requireAuth }         = require("./middleware/auth");
const { requireSubscription } = require("./middleware/subscription");
const { startSubscriptionJob } = require("./services/subscriptionJob");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin",  process.env.CLIENT_URL || "http://localhost:5173");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
  next();
});

// ── Public routes (no auth required) ─────────────────────────────────────────
app.use("/auth",    require("./routes/auth"));
app.use("/admin",   require("./routes/admin"));

// ── Authenticated + subscription-gated /v1/* routes ──────────────────────────
// requireSubscription runs after requireAuth inside each route via the stack below
const v1 = express.Router();
v1.use(requireSubscription); // applies to all /v1/* after auth is established

app.use("/v1/send",      requireAuth("send"),      v1, require("./routes/send"));
app.use("/v1/templates", requireAuth("templates"), v1, require("./routes/templates"));
app.use("/v1/keys",      requireAuth("keys"),      v1, require("./routes/keys"));
app.use("/v1/logs",      requireAuth("send"),      v1, require("./routes/logs"));

// ── Billing status (auth required, no subscription gate — always accessible) ──
app.use("/billing", require("./routes/billing"));

app.get("/health", (_req, res) => res.json({
  status: "ok", version: "4.1.0", auth: "firebase", db: "sqlite",
  ts: new Date().toISOString(),
}));

app.get("/", (_req, res) => res.json({
  service: "MailForge", version: "4.1.0",
  auth: "Firebase Auth (Email/Password + Google)",
  billing: "7-day trial → manual monthly/yearly subscription",
}));

app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error.", detail: err.message });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log("✅  Database synced →", process.env.DB_PATH || "data/mailforge.sqlite");

    startSubscriptionJob();

    app.listen(PORT, () => {
      console.log("");
      console.log("╔══════════════════════════════════════════════════════╗");
      console.log("║   MailForge  v4.1  — Firebase Auth + Subscriptions   ║");
      console.log(`║   http://localhost:${PORT}                            ║`);
      console.log("╠══════════════════════════════════════════════════════╣");
      console.log(`║   Admin key: ${(process.env.ADMIN_KEY || "admin_changeme").padEnd(39)}║`);
      console.log("╚══════════════════════════════════════════════════════╝");
      console.log("");
    });
  } catch (err) {
    console.error("❌  Failed to start:", err.message);
    process.exit(1);
  }
})();

module.exports = app;
