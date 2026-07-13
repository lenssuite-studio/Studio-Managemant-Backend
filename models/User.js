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
      enum: ["superadmin", "studio_admin"],
      default: "studio_admin",
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
