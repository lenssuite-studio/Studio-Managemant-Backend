// One-off, idempotent migration: backfill Studio documents + studioId onto
// existing studio_admin Users and their AddCustomer records.
//
// Safe to run multiple times: every step only touches documents that are
// still missing studioId, and nothing is ever deleted or overwritten.
//
// Usage:
//   MONGO_URI="<production connection string>" node scripts/backfillStudioId.js
//
// The tenant middleware (middleware/tenantMiddleware.js) already does this
// lazily, per studio, on that studio's first request after deploy — running
// this script is optional, but recommended to migrate everyone up front
// instead of paying the one-time lazy-migration cost on each studio's next
// login.

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Studio from "../models/Studio.js";
import AddCustomer from "../models/AddCustomer.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB ✅");

  const users = await User.find({
    role: "studio_admin",
    studioId: null,
  });

  console.log(`Found ${users.length} studio_admin user(s) without a studioId.`);

  let studiosCreated = 0;
  let customersUpdated = 0;

  for (const user of users) {
    const studio = await Studio.create({
      studioName: user.username,
      ownerId: user._id,
    });

    user.studioId = studio._id;
    await user.save();
    studiosCreated += 1;

    const result = await AddCustomer.updateMany(
      { userId: user._id, studioId: { $exists: false } },
      { $set: { studioId: studio._id } },
    );
    customersUpdated += result.modifiedCount ?? 0;

    console.log(
      `  → ${user.email}: created Studio ${studio._id}, backfilled ${result.modifiedCount ?? 0} customer record(s)`,
    );
  }

  const remainingOrphans = await AddCustomer.countDocuments({
    studioId: { $exists: false },
  });

  console.log("----------------------------------------");
  console.log(`Studios created:            ${studiosCreated}`);
  console.log(`AddCustomer docs backfilled: ${customersUpdated}`);
  console.log(`AddCustomer docs still missing studioId: ${remainingOrphans}`);
  if (remainingOrphans > 0) {
    console.log(
      "  (these belong to a userId whose User document no longer exists — investigate before relying on studioId-only queries)",
    );
  }

  await mongoose.disconnect();
  console.log("Done ✅");
}

run().catch((error) => {
  console.error("Backfill failed ❌", error);
  process.exit(1);
});
