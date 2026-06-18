import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    let token = req.headers.authorization;

    // Haddii token-ku uu wato erayga 'Bearer ', ka saar oo kaliya token-ka reeb
    if (token && token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        error: "Fasax ma lihid, Token maqan",
      });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🌟 AMNIGA CUSUB: Hubi haddii uu jiro isbeddel dhanka Browser-ka ah (User-Agent)
    const currentDevice = req.headers["user-agent"] || "unknown_browser";
    if (decoded.ua && decoded.ua !== currentDevice) {
      return res.status(401).json({
        error: "Fasax ma lihid! Token-kan waxaa laga soo xaday browser kale ❌",
      });
    }

    // Xogta ku kaydi 'req' si middleware-ka xiga uu u arko
    req.userId = decoded.id;
    req.role = decoded.role; // Halkan 'req.role' ayaa lagu kaydiyey

    next();
  } catch (error) {
    // 🌟 SAXIDDA CILADDA: Haddii token-ku uu dhaco (Expired), waxaan u soo celinaa farriin gaar ah
    // si React uu u ogaado inuu waco endpoint-ka cusub ee refresh token-ka.
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "token_expired",
        message: "Access Token-ka waa uu dhacay, fadlan cusboonaysii.",
      });
    }

    return res.status(401).json({
      error: "Token-ka waa khaldan yahay ama wuu dhacay",
    });
  }
};

// Middleware-ka hubinaya Role-ka
export const authorize = (...roles) => {
  return (req, res, next) => {
    // 🔥 SAXIDDA: Waxaan ka dhignay 'req.role' halkii ay ka ahayd 'req.user.role'
    if (!roles.includes(req.role)) {
      return res
        .status(403)
        .json({ message: "Amar uma haysid inaad bogggan gasho!" });
    }
    next();
  };
};