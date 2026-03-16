const { MongoClient } = require("mongodb");

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
  console.warn("MONGODB_URI is not set. MongoDB connection will fail until it is configured.");
}

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }

  const dbName = new URL(MONGODB_URI).pathname.replace(/^\//, "") || "default";
  cachedDb = cachedClient.db(dbName);
  return cachedDb;
}

module.exports = {
  getDb,
};

