// ecosystem.config.js — PM2 process config
// Place this at the ROOT of your repo on the VPS

module.exports = {
  apps: [
    {
      name: "mailforge-api",
      script: "./backend/src/index.js",
      cwd: "/var/www/mailforge",

      // ── Clustering ─────────────────────────────────────────────
      instances: 1,         // set to "max" to use all CPU cores
      exec_mode: "fork",    // change to "cluster" if instances > 1

      // ── Environment ────────────────────────────────────────────
      env_production: {
        NODE_ENV:    "production",
        PORT:        3000,
        // All secrets come from .env on the server — do NOT hardcode here
      },

      // ── Reliability ────────────────────────────────────────────
      watch:            false,    // don't watch files in prod
      max_memory_restart: "400M", // restart if memory exceeds 400MB
      restart_delay:    3000,     // wait 3s between crash restarts
      max_restarts:     10,

      // ── Logging ────────────────────────────────────────────────
      out_file:   "/var/log/mailforge/out.log",
      error_file: "/var/log/mailforge/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
