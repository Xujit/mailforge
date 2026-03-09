// ecosystem.config.js — PM2 process config
// Lives at the repo root on the VPS

module.exports = {
  apps: [
    {
      name:       "mailforge-api",
      script:     "./backend/src/index.js",
      cwd:        "/var/www/mailforge",
      instances:  1,
      exec_mode:  "fork",
      env_production: {
        NODE_ENV: "production",
        PORT:     3000,
      },
      watch:              false,
      max_memory_restart: "400M",
      restart_delay:      3000,
      max_restarts:       10,
      out_file:   "/var/log/mailforge/out.log",
      error_file: "/var/log/mailforge/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
