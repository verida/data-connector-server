module.exports = {
    apps: [
      {
        name: 'dcs',
        script: './docker/start.sh',
        interpreter: 'sh',
        kill_timeout: 15000,
      }
    ]
  };
  