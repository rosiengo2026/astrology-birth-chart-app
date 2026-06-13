module.exports = {
  apps: [
    {
      name: "astrology-backend",
      cwd: "./backend",
      script: "dist/server.js",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    },
    {
      name: "astrology-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
