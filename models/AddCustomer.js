import mongoose from "mongoose";
import { tenantScopePlugin } from "./plugins/tenantScope.js";

const AddCustomerSchem = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    Phone: {
      type: String,
      required: true,
    },
    folderName: {
      type: String,
      required: true,
    },

    customerType: {
      type: String,
      enum: ["VIP", "NORMAL"],
      required: true,
      default: "VIP",
    },

    PhotoType: {
      type: String,
      enum: [
        "FullBody",
        "ID_Card",
        "Headshot",
        "Portrait",
        "Certificate",
        "Wedding",
      ],
      required: true,
      default: "FullBody",
    },

    status: {
      type: String,
      enum: ["Pending", "Delivered", "Completed"],
      required: true,
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      // 🌟 PHASE 2 (cleanup/sync): server-derived from cashAmount/zaadAmount/
      // edahabAmount at create/edit time (see derivePaymentMethod in
      // server.js) — never trusted from client input. "Mixed" covers split
      // payments. "SAAD" is a legacy enum value kept only for backward
      // compatibility with any pre-existing record; new records use "Zaad"
      // (the name used everywhere else in the app: zaadAmount, UI labels).
      enum: ["Cash", "Zaad", "Edahab", "Mixed", "SAAD"],
      required: true,
      default: "Cash",
    },

    amountPaid: {
      type: Number,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },
    numberOfPhotos: {
      type: Number,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },

    vipTierLevel: {
      type: String,
      enum: ["VIP_1", "VIP_2", "VIP_3"],
      default: "VIP_1",
    },

    normalPhotosCount: {
      type: Number,
      default: 0,
    },
    vipPhotosCount: {
      type: Number,
      default: 0,
    },

    expPhotosCount: { type: Number, default: 0 },
    expExtraCharge: { type: Number, default: 0 },

    cashAmount: { type: Number, default: 0 },
    zaadAmount: { type: Number, default: 0 },
    edahabAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AddCustomerSchem.index({ studioId: 1, createdAt: -1 });

AddCustomerSchem.plugin(tenantScopePlugin);

export default mongoose.model("AddCustomer", AddCustomerSchem);