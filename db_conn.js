// Load configuration environment variables.
import dotenv from "dotenv";
dotenv.config();

import { MongoClient, ServerApiVersion } from 'mongodb';
const uri = process.env.ATLAS_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version.
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const db = client.db("sample_mflix");
export default db; 
