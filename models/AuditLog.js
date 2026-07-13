import mongoose from "mongoose";

// 🌟 PHASE 3 (fraud-prevention): APPEND-ONLY audit trail. No route or
// controller in this app may ever update or delete an AuditLog document —
// only .create() is used against this model, anywhere in the codebase.
const auditLogSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["create", "edit", "delete", "archive"],
      required: true,
    },
    outcome: {
      type: String,
      enum: ["applied", "requested", "approved", "rejected"],
      required: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }, // createdAt IS the immutable event timestamp
);

auditLogSchema.index({ studioId: 1, createdAt: -1 });
auditLogSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
