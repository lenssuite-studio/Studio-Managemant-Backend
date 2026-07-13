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

    if (!user.studioId) {
      const studio = await Studio.create({
        studioName: user.username,
        ownerId: user._id,
      });

      user.studioId = studio._id;
      await user.save();

      // Dib u xir xogtii hore ee AddCustomer ee uu lahaa user-kan, kuwa maqan studioId oo kaliya
      await AddCustomer.updateMany(
        { userId: user._id, studioId: { $exists: false } },
        { $set: { studioId: studio._id } },
      );
    }

    req.studioId = user.studioId;
    next();
  } catch (error) {
    res.status(500).json({ error: "Cilad ayaa dhacday xilliga xaqiijinta studio-ga" });
  }
};
