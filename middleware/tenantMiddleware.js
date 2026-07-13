import User from "../models/User.js";
import Studio from "../models/Studio.js";
import AddCustomer from "../models/AddCustomer.js";

// 🌟 TENANT MIDDLEWARE: Ku xir req.studioId ka dib marka 'protect' la dhammeeyo.
// Superadmin ma laha studio (wuxuu maamulaa dhammaan studio-yada), marka isaga skip.
// Haddii user-ku (studio_admin) uusan wali lahayn studioId (xogtiisu waa production-kii hore),
// halkan si toos ah ayaa loo abuuraa Studio-giisa oo loo xiraa (lazy backfill), iyadoo aan
// wax laga beddelin xogtiisii hore ee AddCustomer — kaliya field-ka studioId ayaa lagu dari doonaa
// kuwa maqan.
export const attachTenant = async (req, res, next) => {
  try {
    if (req.role === "superadmin") {
      return next();
    }

    let user = req._authUser;
    if (!user) {
      user = await User.findById(req.userId);
    }

    if (!user) {
      return res.status(401).json({ error: "Fasax ma lihid, isticmaale lama helin" });
    }

    let needsSave = false;

    // 🌟 PHASE 2: Qiimihii hore ee role-ka (studio_admin) beddel mid cusub (studio_manager).
    // Defense-in-depth — loginUser hore ayuu u sameeyaa tan, halkan waa backstop.
    if (user.role === "studio_admin") {
      user.role = "studio_manager";
      needsSave = true;
    }

    if (!user.studioId) {
      // Shaqaale (employee) marnaba isma abuurin karo studio — waa in la xiraa mid hore u jira.
      if (user.role === "employee") {
        return res.status(403).json({
          error: "Shaqaalahan lama xirin studio — la xiriir maamulaha studio-ga.",
        });
      }

      const studio = await Studio.create({
        studioName: user.username,
        ownerId: user._id,
      });

      user.studioId = studio._id;
      needsSave = true;

      // Dib u xir xogtii hore ee AddCustomer ee uu lahaa user-kan, kuwa maqan studioId oo kaliya
      await AddCustomer.updateMany(
        { userId: user._id, studioId: { $exists: false } },
        { $set: { studioId: studio._id } },
      );
    }

    if (needsSave) {
      await user.save();
    }

    req.studioId = user.studioId;
    req.role = user.role; // Hubi in codsigan gudihiisa uu wato qiimihii role-ka ee la saxay
    next();
  } catch (error) {
    res.status(500).json({ error: "Cilad ayaa dhacday xilliga xaqiijinta studio-ga" });
  }
};
