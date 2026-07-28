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
      // 🌟 PHASE 1 (multi-tenant foundation): every employee must belong to
      // exactly one studio. studio_manager/studio_admin are exempt here only
      // because legacy accounts created before the Studio model existed may
      // still be mid-migration (see tenantMiddleware.js lazy backfill) —
      // enforcing this for them at the schema level would break their login
      // before that backfill runs. No code path creates an employee without
      // studioId, so this is safe to require unconditionally for that role.
      required: function () {
        return this.role === "employee";
      },
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
