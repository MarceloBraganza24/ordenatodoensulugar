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
