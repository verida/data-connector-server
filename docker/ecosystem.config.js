module.exports = {
    apps: [
      {
        name: 'dcs',
        script: './start.sh',
        interpreter: 'sh',
        kill_timeout: 15000,
      }
    ]
  };
  