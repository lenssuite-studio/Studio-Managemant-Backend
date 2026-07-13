import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      // 🌟 PHASE 2: studio_admin waa la beddelay studio_manager, employee waa cusub.
      // studio_admin waxa lagu hayaa enum-ka si ay xogtii hore u sii shaqeyso ilaa
      // migration-ka la socodsiiyo (fiiri scripts/renameStudioAdminRole.js).
      enum: ["superadmin", "studio_manager", "employee", "studio_admin"],
      default: "studio_manager",
    },
    studioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Studio",
      default: null,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
  },

  { timestamps: true },
);

export default mongoose.model("User", userSchema);
