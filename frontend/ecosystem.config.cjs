module.exports = {
  apps: [
    {
      name: "regission-web",
      cwd: "/var/www/regission-web",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "900M",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3000"
      }
    }
  ]
};
