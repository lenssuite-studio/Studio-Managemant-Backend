import mongoose from "mongoose";

const studioSchema = new mongoose.Schema(
  {
    studioName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Studio", studioSchema);
