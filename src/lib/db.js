/* import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!global.__mongooseConn) {
  global.__mongooseConn = { conn: null, promise: null };
}

export async function connectDB() {
  if (global.__mongooseConn.conn) return global.__mongooseConn.conn;

  console.log("Mongo URI exists:", !!MONGODB_URI);
  console.log("Mongo host:", MONGODB_URI?.split("@")[1]?.split("/")[0]);

  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI");
  }

  if (!global.__mongooseConn.promise) {
    global.__mongooseConn.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
      })
      .catch((err) => {
        global.__mongooseConn.promise = null;
        global.__mongooseConn.conn = null;
        throw err;
      });
  }

  global.__mongooseConn.conn = await global.__mongooseConn.promise;
  return global.__mongooseConn.conn;
} */

import mongoose from "mongoose";

global.__mongooseConn = global.__mongooseConn || { conn: null, promise: null };

export async function connectDB() {
  if (global.__mongooseConn.conn) return global.__mongooseConn.conn;

  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");

  global.__mongooseConn.promise =
    global.__mongooseConn.promise ||
    mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });

  global.__mongooseConn.conn = await global.__mongooseConn.promise;
  return global.__mongooseConn.conn;
}
