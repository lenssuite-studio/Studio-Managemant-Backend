import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser"; // 🌟 Diyaar

// Models & Controls
import AddCustomer from "./models/AddCustomer.js";
import { protect, authorize } from "./middleware/authMiddleware.js";
import { attachTenant } from "./middleware/tenantMiddleware.js";
import {
  loginUser,
  registerUser,
  refreshToken,
} from "./controllers/userController.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
 import { forgotPassword, resetPassword} from "./controllers/userController.js";

dotenv.config();

const app = express();

// 🌟 1. CONFIGURATION-KA CORS (Kaliya midkan saxda ah ayaa jira hadda)
app.use(
  cors({
    origin: [
      "https://lenssuitestudio.vercel.app",
      "https://nssuitestudio.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true, // Muhiim si Cookies-ka loo oggolaado
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// 🌟 2. MUHIIM: Render proxies proxy trust-ka iyo shaqada Cookies-ka
app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser()); // 🌟 3. HALKAN AYAA LAGU SHAQALAYSIYAY COOKIE-PARSER-KA

// ==========================================
// 🛡️ RATE LIMITERS (Waa inay halkan sare ku jiraan)
// ==========================================

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "Codsiyo badan ayaa ka yimid IP-gaga, fadlan sug 15 daqiiqo.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: {
    error: "Isku-dayo badan oo khaldan! Fadlan sug 5 daqiiqo ka dib.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
 /// forgotPassword and resetPasswor
app.post("/api/User/forgotPassword", forgotPassword);
app.post("/api/User/resetPassword/:token", resetPassword);

// CODSASHADA MIDDLEWARES-KA
app.use("/api/User/Login", authLimiter);
app.use("/api/User/register", authLimiter);
app.use("/api/", generalLimiter);

// ==========================================
// 🌐 GENERAL ENDPOINTS
// ==========================================

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

app.get("/api/Admin/Studios", protect, async (req, res) => {
  try {
    if (req.role !== "superadmin") {
      return res
        .status(403)
        .json({ error: "Access Denied: Superadmin oo kaliya!" });
    }

    const studios = await User.find({
      role: { $in: ["studio_manager", "studio_admin"] },
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json(studios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    const studioRoles = ["studio_manager", "studio_admin"];
    const totalStudio = await User.countDocuments({ role: { $in: studioRoles } });
    const totalCustomers = await AddCustomer.countDocuments({});

    const activeStudios = await User.countDocuments({
      role: { $in: studioRoles },
      isActive: true,
    });
    const inactiveStudios = await User.countDocuments({
      role: { $in: studioRoles },
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
app.post("/api/User/refresh", refreshToken);

// ==========================================
// 📸 STUDIO CUSTOMER ENDPOINTS
// ==========================================

app.post("/api/Customer/AddCustomer", protect, attachTenant, async (req, res) => {
  try {
    const {
      fullName,
      Phone,
      folderName,
      status,
      customerType,
      PhotoType,
      amountPaid,
      remainingAmount,
      numberOfPhotos,
    } = req.body;

    const NewCustomer = await AddCustomer.create({
      userId: req.userId,
      studioId: req.studioId,
      fullName,
      Phone,
      folderName,
      status,
      customerType,
      PhotoType,
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

app.get("/api/Customer/List", protect, attachTenant, async (req, res) => {
  try {
    const customers = await AddCustomer.find({ studioId: req.studioId }).sort({
      createdAt: -1,
    });
    res.status(200).json(customers);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Cilad ayaa dhacday xilliga soo akhrinta macaamiisha" });
  }
});

app.delete("/api/Customer/Delete/:id", protect, attachTenant, async (req, res) => {
  try {
    const customer = await AddCustomer.findOne({
      _id: req.params.id,
      studioId: req.studioId,
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
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/Customer/Edit/:id", protect, attachTenant, async (req, res) => {
  try {
    const customer = await AddCustomer.findOne({
      _id: req.params.id,
      studioId: req.studioId,
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer lama helin" });
    }

    // 🌟 Ka saar goobaha tenant-ka si aan customer-ku loogu wareejin karin studio kale
    const { studioId, userId, _id, ...safeUpdates } = req.body;

    const updatedCustomer = await AddCustomer.findByIdAndUpdate(
      req.params.id,
      safeUpdates,
      { returnDocument: "after" },
    );

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/Customer/Archive/:id", protect, attachTenant, async (req, res) => {
  try {
    const customer = await AddCustomer.findOne({
      _id: req.params.id,
      studioId: req.studioId,
    });

    if (!customer) {
      return res
        .status(404)
        .json({ error: "Macmiilkan lama helin ama fasax u maku lihid!" });
    }

    const updatedCustomer = await AddCustomer.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { returnDocument: "after" },
    );

    res.status(200).json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🧑‍💼 STUDIO TEAM ENDPOINTS (Studio Manager only)
// ==========================================

app.post(
  "/api/Studio/Employees",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          error: "Fadlan buuxi username, email, iyo password.",
        });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res
          .status(400)
          .json({ error: "Email-kan horey ayuu u diiwaan gashanaa." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const employee = await User.create({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "employee",
        studioId: req.studioId,
        isActive: true,
      });

      res.status(201).json({
        message: "✅ Shaqaalaha si guul leh ayaa loo daray!",
        employee: {
          _id: employee._id,
          username: employee.username,
          email: employee.email,
          role: employee.role,
          isActive: employee.isActive,
          createdAt: employee.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get(
  "/api/Studio/Employees",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const employees = await User.find({
        studioId: req.studioId,
        role: "employee",
      })
        .select("-password")
        .sort({ createdAt: -1 });

      res.status(200).json(employees);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ==========================================
// 🚀 MONGOOSE & SERVER BOOT
// ==========================================
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
