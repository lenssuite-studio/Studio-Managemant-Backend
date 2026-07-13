import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser"; // 🌟 Diyaar

// Models & Controls
import AddCustomer from "./models/AddCustomer.js";
import AuditLog from "./models/AuditLog.js";
import PendingChange from "./models/PendingChange.js";
import { protect, authorize } from "./middleware/authMiddleware.js";
import { attachTenant } from "./middleware/tenantMiddleware.js";
import {
  loginUser,
  registerUser,
  refreshToken,
  getProfile,
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
app.get("/api/User/Profile", protect, attachTenant, getProfile);

// ==========================================
// 📸 STUDIO CUSTOMER ENDPOINTS
// ==========================================

// 🌟 PHASE 3 (fraud-prevention) helpers
const AUDIT_FIELDS = [
  "fullName",
  "Phone",
  "folderName",
  "customerType",
  "PhotoType",
  "status",
  "amountPaid",
  "remainingAmount",
  "numberOfPhotos",
  "isArchived",
];

// isArchived ma aha field uu Edit-form-ku toos u bedelo — waxaa leh route gaar ah (Archive)
const EDITABLE_FIELDS = AUDIT_FIELDS.filter((field) => field !== "isArchived");

const ACTION_LABELS = { edit: "bedeli", delete: "tirtiri", archive: "kaydin (archive)" };

function snapshotCustomer(customer) {
  const snap = {};
  for (const field of AUDIT_FIELDS) snap[field] = customer[field];
  return snap;
}

function isStudioManagerRole(role) {
  return role === "studio_manager" || role === "studio_admin";
}

// Hubi in order-ku uusan horey isbeddel u sugayn — haddii uu leeyahay, ha la
// oggolaanin wax isbeddel cusub oo toos ah (Manager) ama codsi cusub (Employee)
// intii aan la ansixin/diidin kii hore. Tan waxay ka hortagaysaa in la ansixiyo
// isbeddel "pending" oo hore u noqday mid aan la socon (stale) haddii qofka
// Manager-ka ahi si toos ah wax uga beddelo diiwaanka intii codsigu sugayay.
async function hasPendingChange(customer) {
  const existingPending = await PendingChange.findOne({
    customerId: customer._id,
    status: "pending",
  });
  return Boolean(existingPending);
}

// Haddii request-ku ka yimaado Employee: hubi in order-ku uusan Completed ahayn,
// kadibna abuur PendingChange + AuditLog("requested") halkii ay ka ahaan lahayd
// in AddCustomer-ka toos loo bedelo.
// Wuxuu soo celiyaa `true` haddii uu jawaabta HTTP-ga dhammeeystiray (handled),
// `false` haddii aysan jirin wax ka hor istaagay (route-ku ha sii wato Manager path-ka).
async function tryQueueEmployeeChange(req, res, customer, actionType, proposedChanges, beforeSnapshot) {
  if (customer.status === "Completed") {
    res.status(403).json({
      error: `Shaqaaluhu ma ${ACTION_LABELS[actionType]} karaan order-yada la dhammeeyay (Completed).`,
    });
    return true;
  }

  const pendingChange = await PendingChange.create({
    studioId: req.studioId,
    customerId: customer._id,
    requestedBy: req.userId,
    actionType,
    proposedChanges,
    originalSnapshot: snapshotCustomer(customer),
  });

  await AuditLog.create({
    studioId: req.studioId,
    customerId: customer._id,
    userId: req.userId,
    action: actionType,
    outcome: "requested",
    before: beforeSnapshot,
    after: proposedChanges,
  });

  res.status(202).json({
    pending: true,
    message: "Codsigaaga waxaa loo diray maamulaha si loo ansixiyo.",
    pendingChangeId: pendingChange._id,
  });
  return true;
}

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

    await AuditLog.create({
      studioId: req.studioId,
      customerId: NewCustomer._id,
      userId: req.userId,
      action: "create",
      outcome: "applied",
      before: null,
      after: snapshotCustomer(NewCustomer),
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

    // 🌟 Ku dar calaamadda "isbeddel sugaya" haddii mid jiro, si Dashboard-ku u ogaado
    const pendingChanges = await PendingChange.find({
      studioId: req.studioId,
      status: "pending",
    }).select("customerId actionType requestedBy createdAt");

    const pendingByCustomer = new Map();
    for (const pc of pendingChanges) {
      pendingByCustomer.set(String(pc.customerId), {
        actionType: pc.actionType,
        requestedBy: pc.requestedBy,
        createdAt: pc.createdAt,
      });
    }

    const withPending = customers.map((c) => {
      const obj = c.toObject();
      obj.pendingChange = pendingByCustomer.get(String(c._id)) || null;
      return obj;
    });

    res.status(200).json(withPending);
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

    if (await hasPendingChange(customer)) {
      return res.status(409).json({
        error: "Order-kan wuxuu leeyahay isbeddel sugaya ansixin. Fadlan marka hore ansixi ama diid isbeddelkaas.",
      });
    }

    if (!isStudioManagerRole(req.role)) {
      const before = snapshotCustomer(customer);
      const handled = await tryQueueEmployeeChange(req, res, customer, "delete", null, before);
      if (handled) return;
    }

    const before = snapshotCustomer(customer);
    await AddCustomer.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      studioId: req.studioId,
      customerId: customer._id,
      userId: req.userId,
      action: "delete",
      outcome: "applied",
      before,
      after: null,
    });

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

    if (await hasPendingChange(customer)) {
      return res.status(409).json({
        error: "Order-kan wuxuu leeyahay isbeddel sugaya ansixin. Fadlan marka hore ansixi ama diid isbeddelkaas.",
      });
    }

    // 🌟 Kaliya goobaha dhabta ah ee la ogol yahay in la bedelo ayaa la aqbalayaa
    // (halkii safeUpdates laga dhigi lahaa "wax kasta oo aan tenant ahayn ee body-ga ku jira"),
    // si aan diiwaanka audit-ka ugu dari qiyamo aan macno lahayn (createdAt, __v, pendingChange, iwm.)
    const safeUpdates = {};
    for (const field of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        safeUpdates[field] = req.body[field];
      }
    }

    if (!isStudioManagerRole(req.role)) {
      const before = {};
      for (const key of Object.keys(safeUpdates)) before[key] = customer[key];
      const handled = await tryQueueEmployeeChange(req, res, customer, "edit", safeUpdates, before);
      if (handled) return;
    }

    const before = {};
    for (const key of Object.keys(safeUpdates)) before[key] = customer[key];

    const updatedCustomer = await AddCustomer.findByIdAndUpdate(
      req.params.id,
      safeUpdates,
      { returnDocument: "after" },
    );

    await AuditLog.create({
      studioId: req.studioId,
      customerId: customer._id,
      userId: req.userId,
      action: "edit",
      outcome: "applied",
      before,
      after: safeUpdates,
    });

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

    if (await hasPendingChange(customer)) {
      return res.status(409).json({
        error: "Order-kan wuxuu leeyahay isbeddel sugaya ansixin. Fadlan marka hore ansixi ama diid isbeddelkaas.",
      });
    }

    if (!isStudioManagerRole(req.role)) {
      const before = { isArchived: customer.isArchived };
      const handled = await tryQueueEmployeeChange(
        req,
        res,
        customer,
        "archive",
        { isArchived: true },
        before,
      );
      if (handled) return;
    }

    const before = { isArchived: customer.isArchived };
    const updatedCustomer = await AddCustomer.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { returnDocument: "after" },
    );

    await AuditLog.create({
      studioId: req.studioId,
      customerId: customer._id,
      userId: req.userId,
      action: "archive",
      outcome: "applied",
      before,
      after: { isArchived: true },
    });

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

// 🌟 PHASE 3: Toggle-ka waa in la geliyaa ka hor route-ka guud ee /:id
// si "Toggle" uusan loola dhaqmin sidii uu yahay :id
app.put(
  "/api/Studio/Employees/Toggle/:id",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const employee = await User.findOne({
        _id: req.params.id,
        studioId: req.studioId,
        role: "employee",
      });

      if (!employee) {
        return res.status(404).json({ error: "Shaqaale lama helin ama fasax uma lihid" });
      }

      employee.isActive = !employee.isActive;
      await employee.save();

      res.status(200).json({
        message: "Xaaladda shaqaalaha waa la beddelay!",
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

app.put(
  "/api/Studio/Employees/:id",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const employee = await User.findOne({
        _id: req.params.id,
        studioId: req.studioId,
        role: "employee",
      });

      if (!employee) {
        return res.status(404).json({ error: "Shaqaale lama helin ama fasax uma lihid" });
      }

      const { username, email } = req.body;
      if (username) employee.username = username;
      if (email) employee.email = email.toLowerCase();

      await employee.save();

      res.status(200).json({
        message: "Shaqaalaha si guul leh ayaa wax looga beddelay!",
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

app.delete(
  "/api/Studio/Employees/:id",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const employee = await User.findOneAndDelete({
        _id: req.params.id,
        studioId: req.studioId,
        role: "employee",
      });

      if (!employee) {
        return res.status(404).json({ error: "Shaqaale lama helin ama fasax uma lihid" });
      }

      res.status(200).json({
        message: "Shaqaalaha waa la tirtiray",
        id: req.params.id,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ==========================================
// ✅ FRAUD-PREVENTION: PENDING CHANGES (Studio Manager only)
// ==========================================

app.get(
  "/api/Studio/PendingChanges",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const pendingChanges = await PendingChange.find({
        studioId: req.studioId,
        status: "pending",
      })
        .populate("requestedBy", "username email")
        .populate("customerId", "fullName folderName status")
        .sort({ createdAt: -1 });

      res.status(200).json(pendingChanges);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.put(
  "/api/Studio/PendingChanges/Approve/:id",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const pendingChange = await PendingChange.findOne({
        _id: req.params.id,
        studioId: req.studioId,
        status: "pending",
      });

      if (!pendingChange) {
        return res.status(404).json({
          error: "Pending change lama helin ama horey ayaa loo fasaxay/diiday",
        });
      }

      const customer = await AddCustomer.findOne({
        _id: pendingChange.customerId,
        studioId: req.studioId,
      });

      if (!customer) {
        return res.status(404).json({ error: "Order-ka asalka ah lama helin" });
      }

      let before = null;
      let after = null;

      if (pendingChange.actionType === "edit") {
        before = {};
        after = {};
        for (const key of Object.keys(pendingChange.proposedChanges || {})) {
          before[key] = customer[key];
          after[key] = pendingChange.proposedChanges[key];
          customer[key] = pendingChange.proposedChanges[key];
        }
        await customer.save();
      } else if (pendingChange.actionType === "archive") {
        before = { isArchived: customer.isArchived };
        after = { isArchived: true };
        customer.isArchived = true;
        await customer.save();
      } else if (pendingChange.actionType === "delete") {
        before = snapshotCustomer(customer);
        after = null;
        await AddCustomer.findByIdAndDelete(customer._id);
      }

      pendingChange.status = "approved";
      pendingChange.reviewedBy = req.userId;
      pendingChange.reviewedAt = new Date();
      await pendingChange.save();

      await AuditLog.create({
        studioId: req.studioId,
        customerId: pendingChange.customerId,
        userId: req.userId,
        action: pendingChange.actionType,
        outcome: "approved",
        before,
        after,
      });

      res.status(200).json({
        message: "Isbeddelka waa la ansixiyay!",
        pendingChange,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.put(
  "/api/Studio/PendingChanges/Reject/:id",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const pendingChange = await PendingChange.findOne({
        _id: req.params.id,
        studioId: req.studioId,
        status: "pending",
      });

      if (!pendingChange) {
        return res.status(404).json({
          error: "Pending change lama helin ama horey ayaa loo fasaxay/diiday",
        });
      }

      pendingChange.status = "rejected";
      pendingChange.reviewedBy = req.userId;
      pendingChange.reviewedAt = new Date();
      await pendingChange.save();

      await AuditLog.create({
        studioId: req.studioId,
        customerId: pendingChange.customerId,
        userId: req.userId,
        action: pendingChange.actionType,
        outcome: "rejected",
        before: pendingChange.originalSnapshot,
        after: pendingChange.proposedChanges,
      });

      res.status(200).json({
        message: "Isbeddelka waa la diiday.",
        pendingChange,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ==========================================
// 🕵️ FRAUD-PREVENTION: ACTIVITY HISTORY API (Studio Manager only)
// ==========================================

app.get(
  "/api/Studio/ActivityHistory",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const filter = { studioId: req.studioId };
      if (req.query.customerId) {
        filter.customerId = req.query.customerId;
      }

      const history = await AuditLog.find(filter)
        .populate("userId", "username email role")
        .populate("customerId", "fullName folderName")
        .sort({ createdAt: -1 })
        .limit(200);

      res.status(200).json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// ==========================================
// 📊 PHASE 4: REPORTING API (Studio Manager only)
// ==========================================

app.get(
  "/api/Studio/Reports",
  protect,
  authorize("studio_manager", "studio_admin"),
  attachTenant,
  async (req, res) => {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ error: "Fadlan sii 'from' iyo 'to' (taariikhaha)." });
      }

      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ error: "Taariikhaha 'from'/'to' waa khaldan yihiin." });
      }

      const match = {
        studioId: req.studioId,
        createdAt: { $gte: fromDate, $lte: toDate },
      };

      const [summary] = await AddCustomer.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: "$amountPaid" },
            totalOutstanding: { $sum: "$remainingAmount" },
            totalPhotos: { $sum: "$numberOfPhotos" },
            orderCount: { $sum: 1 },
          },
        },
      ]);

      const employeePerformanceRaw = await AddCustomer.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$userId",
            orderCount: { $sum: 1 },
            revenue: { $sum: "$amountPaid" },
            photoCount: { $sum: "$numberOfPhotos" },
          },
        },
        { $sort: { revenue: -1 } },
      ]);

      const userIds = employeePerformanceRaw.map((e) => e._id).filter(Boolean);
      const users = await User.find({ _id: { $in: userIds } }).select("username role");
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      const employeePerformance = employeePerformanceRaw.map((e) => ({
        userId: e._id,
        username: userMap.get(String(e._id))?.username || "(deleted user)",
        role: userMap.get(String(e._id))?.role || null,
        orderCount: e.orderCount,
        revenue: e.revenue,
        photoCount: e.photoCount,
      }));

      const serviceBreakdownRaw = await AddCustomer.aggregate([
        { $match: match },
        { $group: { _id: "$PhotoType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const serviceBreakdown = serviceBreakdownRaw.map((s) => ({
        photoType: s._id,
        count: s.count,
      }));

      res.status(200).json({
        range: { from: fromDate, to: toDate },
        revenue: {
          totalPaid: summary?.totalPaid || 0,
          totalOutstanding: summary?.totalOutstanding || 0,
          orderCount: summary?.orderCount || 0,
        },
        photoCount: summary?.totalPhotos || 0,
        employeePerformance,
        serviceBreakdown,
      });
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
