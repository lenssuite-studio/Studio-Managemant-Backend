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
      default: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "studio_admin"],
      default: "studio_admin",
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
