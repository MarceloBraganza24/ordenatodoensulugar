import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  try {
    console.log("Mongo URI exists:", !!process.env.MONGODB_URI);
    console.log(
      "Mongo host:",
      process.env.MONGODB_URI?.match(/@([^/]+)/)?.[1]
    );

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "ecommerce-cocina",
    });

    console.log("✅ Conectó a MongoDB correctamente");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error conectando a Mongo:", err);
    process.exit(1);
  }
}

main();