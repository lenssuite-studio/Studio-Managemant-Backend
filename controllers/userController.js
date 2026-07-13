import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Studio from "../models/Studio.js";
import crypto from "crypto";
import  "dotenv/config"
// 1. Waxaan meesha ka saarnay nodemailer waxaanan soo ragnay Resend
import { Resend } from "resend";

// 2. Diyaarinta Resend API Key (Wuxuu ka akhrisanayaa .env)
const resend = new Resend(process.env.RESEND_API_KEY);

// 🌟 ACCESS TOKEN: Wuxuu dhacayaa 15 daqiiqo oo kaliya
const generateAccessToken = (id, role, req) => {
  const userAgent = req.headers["user-agent"] || "unknown_browser";
  return jwt.sign({ id, role, ua: userAgent }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// 🌟 REFRESH TOKEN: Wuxuu dhacayaa 7 maalmood
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Please provide username, email, and password.",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    // 🌟 MULTI-TENANT: Studio cusub oo u gaar ah isticmaalahan cusub, si loola socdo nidaamka studioId
    const studio = await Studio.create({
      studioName: username,
      ownerId: createdUser._id,
    });
    createdUser.studioId = studio._id;
    await createdUser.save();

    return res.status(201).json({
      message: "User registered successfully.",
      user: {
        id: createdUser._id,
        username: createdUser.username,
        email: createdUser.email,
        role: createdUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while registering user.",
      error: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Akoon-kan waa la xannibay! La xiri Superadmin-ka." });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // 🌟 PHASE 2: Beddel qiimihii hore ee role-ka (studio_admin) mid cusub (studio_manager)
    // kahor inta aan la keydin, si aan khalad enum-validation ah u dhicin.
    if (user.role === "studio_admin") {
      user.role = "studio_manager";
    }

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id, user.role, req);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful.",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while logging in.",
      error: error.message,
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const cookies = req.cookies;

    if (!cookies || !cookies.refreshToken) {
      return res
        .status(401)
        .json({ message: "Fasax ma lihid, Refresh Token waa maqan yahay" });
    }

    const refreshToken = cookies.refreshToken;
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res
        .status(403)
        .json({ message: "Akoon-kan ma jiro ama waa la xannibay" });
    }

    const newAccessToken = generateAccessToken(user._id, user.role, req);

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    return res.status(403).json({
      message: "Refresh Token-ku waa khaldan yahay ama wuu dhacay",
    });
  }
};

// 🔥 3. CODSI IN PASSWORD-KA LA BEDDELO (Forgot Password - RESEND VERSION)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Fadlan soo qor email-kaaga." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "Email-kan kama jiro nidaamka!" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 daqiiqo

    await user.save();

    const resetURL = `https://lenssuitestudio.vercel.app/reset-password/${resetToken}`;

    // 🌟 RESEND EMAIL DISPATCH
    await resend.emails.send({
      from: "LensSuite Support <onboarding@resend.dev>", // Tijaabada domain-ka resend ayaa la ragaa
      to: user.email, // Wuxuu toos ugu dhacayaa email-ka dhabta ah ee isticmaalaha
      subject: "LensSuite - Soo celinta Password-ka",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px;">
          <h2 style="color: #333;">Soo celinta Password-ka LensSuite</h2>
          <p>Walaal, waxaad codsatay in lagaa beddelo password-ka akoonkaaga.</p>
          <p>Fadlan riix badhanka hoose si aad u bixiso password cusub (Wuxuu dhacayaa 10 daqiiqo gudahood):</p>
          <a href="${resetURL}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; border-radius: 5px; margin-top: 10px;">Beddel Password-ka</a>
          <p style="margin-top: 20px; color: #777; font-size: 12px;">Haddii aadan adigu codsan, fadlan iska indho-tir email-kan.</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: "Link-gii dib u dajinta password-ka waxaa loo diray email-kaaga dhabta ah! 📬",
      resetToken: resetToken,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Cillad ayaa ku dhacday dirista email-ka.",
      error: error.message,
    });
  }
};

// 🌟 PHASE 3: PROFILE-KA ISTICMAALAHA HADDA LOGIN AH (view-only)
export const getProfile = async (req, res) => {
  try {
    const user = req._authUser || (await User.findById(req.userId));
    if (!user) {
      return res.status(404).json({ message: "Isticmaale lama helin." });
    }

    let studioName = null;
    if (req.studioId) {
      const studio = await Studio.findById(req.studioId).select("studioName");
      studioName = studio?.studioName || null;
    }

    return res.status(200).json({
      username: user.username,
      email: user.email,
      role: user.role,
      studioName,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while loading profile.",
      error: error.message,
    });
  }
};

// 4. BEDDELKA PASWORD-KA CUSUB (Reset Password)
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Fadlan qor password-ka cusub." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Token-ku waa khaldan yahay ama waqtigiisii wuu dhacay! ❌",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return res
      .status(200)
      .json({ message: "Password-kaagii si guul leh ayaa loo beddelay! 🎉" });
  } catch (error) {
    return res.status(500).json({
      message: "Server error inta password-ka la beddelayay.",
      error: error.message,
    });
  }
};