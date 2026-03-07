require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set — using insecure default.");
  process.env.JWT_SECRET = "CHANGE_ME_IN_PRODUCTION_mailforge_jwt_secret";
}

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — allow the React dev server
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_URL || "http://localhost:5173");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
  next();
});

app.use("/auth",          require("./routes/auth"));
app.use("/admin",         require("./routes/admin"));
app.use("/v1/send",       require("./routes/send"));
app.use("/v1/templates",  require("./routes/templates"));
app.use("/v1/keys",       require("./routes/keys"));
app.use("/v1/logs",       require("./routes/logs"));

app.get("/health", (_req, res) => res.json({ status: "ok", version: "3.0.0", ts: new Date().toISOString() }));

app.get("/", (_req, res) => res.json({
  service: "MailForge", version: "3.0.0",
  flow: "POST /auth/register → admin approves at /admin/tenants → POST /auth/login",
}));

app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error.", detail: err.message });
});

app.listen(PORT, () => {
  const adminKey = process.env.ADMIN_KEY || "admin_changeme";
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   MailForge  v3.0  — Approval-gated tenants  ║");
  console.log(`║   http://localhost:${PORT}                    ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║   Admin key:  ${adminKey.padEnd(30)} ║`);
  console.log("║   Admin UI:   http://localhost:5173/admin     ║");
  console.log("╚══════════════════════════════════════════════╝\n");
});

module.exports = app;
