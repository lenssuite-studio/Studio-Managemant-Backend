import mongoose from "mongoose";
import { tenantScopePlugin } from "./plugins/tenantScope.js";

const expenseSchema = new mongoose.Schema(
  {
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["Rent", "Equipment", "Supplies", "Utilities", "Salaries", "Marketing", "Other"],
      default: "Other",
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

expenseSchema.index({ studioId: 1, date: -1 });

expenseSchema.plugin(tenantScopePlugin);

export default mongoose.model("Expense", expenseSchema);
