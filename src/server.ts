/*
This lets us run the Express server locally 
*/
const app = require('./server-app');

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});