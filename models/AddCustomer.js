import mongoose from "mongoose";

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
      require: true,
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
      require: true,
      default: "FullBody",
    },

    status: {
      type: String,
      enum: ["Pending", "Delivered", "Completed"],
      require: true,
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Edahab", "SAAD"],
      required: true,
      default: "Cash",
    },
    normalPhotosCount: {
      type: Number,
      default: 0,
    },
    vipPhotosCount: {
      type: Number,
      default: 0,
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
      default: false, // Marka macmiilka la abuurayo marka hore la archive-gareyn maayo
    },
  },
  { timestamps: true },
);

AddCustomerSchem.index({ studioId: 1, createdAt: -1 });

export default mongoose.model("AddCustomer", AddCustomerSchem);
