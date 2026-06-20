import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

// 🌟 1. ACCESS TOKEN: Wuxuu dhacayaa 15 daqiiqo oo kaliya (Kani waa kan ammaanaya foomamka iyo macaamiisha)
const generateAccessToken = (id, role, req) => {
  const userAgent = req.headers["user-agent"] || "unknown_browser";
  return jwt.sign({ id, role, ua: userAgent }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

// 🌟 2. REFRESH TOKEN: Wuxuu dhacayaa 7 maalmood, shaqadiisuna waa inuu Access Token cusub dhalo
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

    return res.status(201).json({
      message: "User registered successfully.",
      user: {
        id: createdUser._id,
        username: createdUser.username,
        email: createdUser.email,
        role: createdUser.role, // Lagu daray
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

    // Hubi haddii uu Admin-ku xannibay (Disabled)
    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Akoon-kan waa la xannibay! La xiri Superadmin-ka." });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    user.lastLogin = new Date();
    await user.save();

    // 🌟 3. DHALINTA ACCESS & REFRESH TOKENS (Waxaa lagu daray 'req')
    const accessToken = generateAccessToken(user._id, user.role, req);
    const refreshToken = generateRefreshToken(user._id);

    // 🌟 4. KU SHUBISTA REFRESH TOKEN-KA HTTP-ONLY COOKIE
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // JavaScript ma akhrisan karto (Anti-XSS / Anti-Copy-Paste)
      secure: process.env.NODE_ENV === "production", // Kaliya wuxuu ku shaqaynayaa HTTPS marka la dhoofiyo
      sameSite: "strict", // Ka hortagga weerarada CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // Wuxuu dhacayaa 7 maalmood gudaheed
    });

    return res.status(200).json({
      message: "Login successful.",
      accessToken, // 🌟 Frontend-ka waxaan hadda u diraynaa Access Token-ka mudada gaaban ah
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role, // 🔥 MAALINTA MAANTA AH KANI AYAA INOO SAXAY CILADDA!
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while logging in.",
      error: error.message,
    });
  }
};

// 🌟 5. ENDPOINT-KA CUSUB EE REFRESH TOKEN (Kani wuxuu soo saaraa Access Token cusub si qarsoon)
export const refreshToken = async (req, res) => {
  try {
    const cookies = req.cookies;

    // Hubi in cookie-ga uu jiro 'refreshToken'
    if (!cookies || !cookies.refreshToken) {
      return res
        .status(401)
        .json({ message: "Fasax ma lihid, Refresh Token waa maqan yahay" });
    }

    const refreshToken = cookies.refreshToken;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Soo hel isticmaalaha si loo helo role-kiisa saxda ah hadda
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res
        .status(403)
        .json({ message: "Akoon-kan ma jiro ama waa la xannibay" });
    }

    // Samee Access Token cusub oo wata 15 daqiiqo oo kale
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

//// rest password

// 1. CODSI IN PASSWORD-KA LA BEDDELO (Forgot Password)
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

    // Dhali Token siri ah oo ammaan ah
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Token-ka oo Hashed ah ku kaydi database-ka (Amni dartiis)
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 daqiiqo ka dib wuu dhacayaa

    await user.save();

    // Link-ga loo dirayo isticmaalaha (Frontend URL)
    const resetURL = `https://lenssuitestudio.vercel.app/reset-password/${resetToken}`;

    // Habaynta Nodemailer (Gmail)
    const transporter = nodemailer.createTransport({
      service: "smtp.ethereal.email",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"LensSuite Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
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
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Link-gii dib u dajinta password-ka waa diyaar (Tijaabo)! 📬",
      resetToken: resetToken, // 🔥 Kani wuxuu kuu oggolaanayaa inaad toos ugu tijaabiso postman ama frontend
      resetURL: resetURL,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Cillad ayaa ku dhacday dirista email-ka.",
      error: error.message,
    });
  }
};

// 2. BEDDELKA PASWORD-KA CUSUB (Reset Password)
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Fadlan qor password-ka cusub." });
    }

    // Isku aadi token-ka ka yimid frontend iyo kii hashed-ka ahaa ee database-ka ku jiray
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }, // Hubi inaanu 10-kii daqiiqo ka dhacin
    });

    if (!user) {
      return res.status(400).json({
        message: "Token-ku waa khaldan yahay ama waqtigiisii wuu dhacay! ❌",
      });
    }

    // Password-ka cusub Hash garee oo kaydi
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Masax token-kii dhashay maadaama la isticmaalay
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
