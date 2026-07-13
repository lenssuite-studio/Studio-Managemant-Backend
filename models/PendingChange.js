import mongoose from "mongoose";

// 🌟 PHASE 3 (fraud-prevention): an Employee's proposed edit/delete/archive
// on a non-completed order, sitting here until a Studio Manager approves or
// rejects it. The underlying AddCustomer document is never touched while a
// PendingChange is "pending" — approval is what applies it.
const pendingChangeSchema = new mongoose.Schema(
  {
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AddCustomer",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actionType: {
      type: String,
      enum: ["edit", "delete", "archive"],
      required: true,
    },
    proposedChanges: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // only meaningful for actionType: "edit"
    },
    originalSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

pendingChangeSchema.index({ studioId: 1, status: 1, createdAt: -1 });
pendingChangeSchema.index({ customerId: 1, status: 1 });

export default mongoose.model("PendingChange", pendingChangeSchema);
