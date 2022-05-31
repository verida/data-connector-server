/*
This lets us run the Express server locally 
*/
import * as PouchDBLib from "pouchdb";
import process from 'process';


const { default: PouchDB } = PouchDBLib as any;

process.chdir('/tmp')

let db = new PouchDB('vmydatabase');

const app = require('./server-app');

const PORT = process.env.SERVER_PORT ? process.env.SERVER_PORT : 5021;
app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});