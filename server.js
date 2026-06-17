import express, { response } from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import AddCustomer from "./models/AddCustomer.js";
import { protect } from "./middleware/authMiddleware.js";
import { loginUser, registerUser } from "./controllers/userController.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB is connected ✅");
    app.listen(PORT, () => {
      console.log(`Server is running: http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.log("DB Connection Error: ❌", err));

// Ku dar meeshaan backend-kaaga (Node.js / Express)
app.get("/api/cron/wakeup", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server-ka Render waa la soo toosiyay!",
  });
});

// ==========================================
// 👑 SUPERADMIN ENDPOINTS
// ==========================================

app.put("/api/Admin/Studios/Toggle/:id", protect, async (req, res) => {
  try {
    if (req.role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Access Denied: Superadmin oo kaliya!" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Studio lama helin!" });

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      message: "Status-ka Studio si guul leh ayaa loo beddelay!",
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. DELETE STUDIO
app.delete("/api/Admin/Studios/Delete/:id", protect, async (req, res) => {
  try {
    if (req.role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Access Denied: Superadmin oo kaliya!" });
    }

    await User.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ message: "Studio-ga waa la tirtiray!", id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Soo saar dhammaan Studios-ka diiwaangashan
app.get("/api/Admin/Studios", protect, async (req, res) => {
  try {
    if (req.role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Access Denied: Superadmin oo kaliya!" });
    }

    const studios = await User.find({ role: "studio_admin" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json(studios);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// 1. Soo saar dhammaan macaamiisha ay studio-yada oo dhan kaydiyeen
app.get("/api/Admin/Customers", protect, async (req, res) => {
  try {
    if (req.role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Access Denied: Superadmin oo kaliya!" });
    }

    const customers = await AddCustomer.find()
      .populate("userId", "username email")
      .sort({ createdAt: -1 });

    res.status(200).json(customers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/Admin/Stats", protect, async (req, res) => {
  try {
    if (req.role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Access Denied: Superadmin oo kaliya!" });
    }
    const totalStudio = await User.countDocuments({ role: "studio_admin" });
    const totalCustomers = await AddCustomer.countDocuments({});

    const activeStudios = await User.countDocuments({
      role: "studio_admin",
      isActive: true,
    });
    const inactiveStudios = await User.countDocuments({
      role: "studio_admin",
      isActive: false,
    });

    res.status(200).json({
      success: true,
      totalStudio,
      totalCustomers,
      activeStudios,
      inactiveStudios,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/Admin/CreateFirstSuperadmin", async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ role: "superadmin" });
    if (existingAdmin)
      return res.status(400).json({ error: "Superadmin hore ayuu u jiray!" });

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const admin = await User.create({
      username: "SuperAdmin HQ",
      email: "admin@lenssuite.com",
      password: hashedPassword,
      role: "superadmin",
    });

    res
      .status(201)
      .json({ message: "👑 Superadmin si guul leh ayaa loo abuuray!", admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🔐 AUTH ENDPOINTS
// ==========================================
app.post("/api/User/register", registerUser);
app.post("/api/User/Login", loginUser);

// ==========================================
// 📸 STUDIO CUSTOMER ENDPOINTS
// ==========================================

// Macmiil ku dar nidaamka
app.post("/api/Customer/AddCustomer", protect, async (req, res) => {
  try {
    const {
      fullName,
      Phone,
      folderName,
      status,
      customerType,
      PhotoType, // 🌟 SAXID: Halkan ayaa lagu soo daray si uusan "VIP" kaliya u noqon
      amountPaid,
      remainingAmount,
      numberOfPhotos,
    } = req.body;

    const NewCustomer = await AddCustomer.create({
      userId: req.userId,
      fullName,
      Phone,
      folderName,
      status,
      customerType,
      PhotoType, // 🌟 Halkan ayaa lagu daray xogtii laga soo qabtay req.body
      amountPaid,
      remainingAmount,
      numberOfPhotos,
    });
    res.status(201).json({
      message: "✅ Macmiilka si guul leh ayaa loo kaydiyay!",
      customer: NewCustomer,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Cilad ayaa dhacday xilliga kaydinta macmiilka" });
  }
});

// Liiska macaamiisha u gaarka ah Studio-ga Login-ka ah
app.get("/api/Customer/List", protect, async (req, res) => {
  try {
    const customers = await AddCustomer.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(customers);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Cilad ayaa dhacday xilliga soo akhrinta macaamiisha" });
  }
});

// Tirtir Macmiil
app.delete("/api/Customer/Delete/:id", protect, async (req, res) => {
  try {
    const customer = await AddCustomer.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!customer) {
      return res
        .status(401)
        .json({ error: "Customer lama helin ama fasax u maku lihid" });
    }

    await AddCustomer.findByIdAndDelete(req.params.id);
    res.status(200).json({
      message: "Customer waa la tirtiray",
      id: req.params.id,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// Wax ka beddel Macmiil (Edit)
app.put("/api/Customer/Edit/:id", protect, async (req, res) => {
  try {
    const customer = await AddCustomer.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer lama helin" });
    }

    const updatedCustomer = await AddCustomer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: "after" },
    );

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📂 5. ARCHIVE CUSTOMER ENDPOINT (KAN CUSUB)
app.put("/api/Customer/Archive/:id", protect, async (req, res) => {
  try {
    // Hubi in macmiilku jiro isla markaana uu leeyahay Studio-gan login-ka ah (Security Check)
    const customer = await AddCustomer.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!customer) {
      return res
        .status(404)
        .json({ error: "Macmiilkan lama helin ama fasax u maku lihid!" });
    }

    // U beddel isArchived mid true ah
    const updatedCustomer = await AddCustomer.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { returnDocument: "after" }, // Tani waxay soo celinaysaa xogtii oo cusub si Redux u helo
    );

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


