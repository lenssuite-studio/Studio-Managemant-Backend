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

      // 🌟 Atomic claim: this update only succeeds if studioId is STILL null
      // at write time. Without this, two concurrent first-requests for the
      // same brand-new user (e.g. two tabs, or two requests firing back to
      // back right after signup) would each read studioId as null, each
      // create their OWN Studio above, and the slower of the two plain
      // user.save() calls would silently overwrite the faster one's
      // assignment — permanently detaching anything already created under
      // the first studioId, since every future request resolves to the
      // second one instead.
      const claimedUser = await User.findOneAndUpdate(
        { _id: user._id, studioId: null },
        { $set: { studioId: studio._id, role: user.role } },
        { new: true },
      );

      if (claimedUser) {
        user = claimedUser;
      } else {
        // Another concurrent request already won the race and claimed a
        // studioId first — discard the Studio we just created and adopt
        // whichever one actually won, instead of silently overwriting it.
        await Studio.deleteOne({ _id: studio._id });
        user = await User.findById(user._id);
      }

      // Dib u xir xogtii hore ee AddCustomer ee uu lahaa user-kan, kuwa maqan studioId oo kaliya
      await AddCustomer.updateMany(
        { userId: user._id, studioId: { $exists: false } },
        { $set: { studioId: user.studioId } },
      );
    } else if (needsSave) {
      await user.save();
    }

    req.studioId = user.studioId;
    req.role = user.role; // Hubi in codsigan gudihiisa uu wato qiimihii role-ka ee la saxay
    next();
  } catch (error) {
    res.status(500).json({ error: "Cilad ayaa dhacday xilliga xaqiijinta studio-ga" });
  }
};
