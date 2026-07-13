// One-off, idempotent migration: rename the legacy role value "studio_admin"
// to "studio_manager" on every User document that still has it.
//
// This is optional — loginUser and the tenant middleware both normalize the
// role lazily (on next login / next authenticated request), and the new
// Studio-team endpoints already accept both values via authorize(), so
// nothing breaks if this script is never run. Running it eagerly just
// finishes the rename for everyone up front instead of waiting for each
// account's next login.
//
// Usage:
//   MONGO_URI="<production connection string>" node scripts/renameStudioAdminRole.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB ✅");

  const result = await User.updateMany(
    { role: "studio_admin" },
    { $set: { role: "studio_manager" } },
  );

  console.log(
    `Renamed ${result.modifiedCount ?? 0} user(s) from studio_admin -> studio_manager.`,
  );

  await mongoose.disconnect();
  console.log("Done ✅");
}

run().catch((error) => {
  console.error("Role rename failed ❌", error);
  process.exit(1);
});
