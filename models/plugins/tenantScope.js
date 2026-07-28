// 🌟 PHASE 1 (multi-tenant foundation): fail-loud guard against cross-studio
// data leakage. Applied to every collection that must never be read without
// a studioId filter (AddCustomer, Expense, AuditLog, PendingChange).
//
// This does NOT auto-inject studioId (there is no per-request tenant context
// available to Mongoose at the schema level without a larger AsyncLocalStorage
// change). Instead it enforces the existing convention: every route in this
// app already passes `studioId` in the query filter. If a future route on a
// guarded model forgets to, the query now throws instead of silently
// returning documents from every studio.
//
// Legitimate cross-tenant queries (superadmin-only) must opt out explicitly:
//   AddCustomer.find().setOptions({ skipTenantGuard: true })
// This makes any cross-tenant read a deliberate, greppable decision instead
// of an accident.
export function tenantScopePlugin(schema) {
  schema.pre(["find", "findOne", "countDocuments"], function (next) {
    const options = this.getOptions();
    if (options && options.skipTenantGuard) {
      return next();
    }

    const filter = this.getQuery();
    if (!filter || !Object.prototype.hasOwnProperty.call(filter, "studioId")) {
      return next(
        new Error(
          `Tenant guard: a "${this.model.modelName}" query is missing studioId in its filter. ` +
            `Add studioId to the query, or if this is a verified superadmin cross-studio read, ` +
            `opt out explicitly with .setOptions({ skipTenantGuard: true }).`,
        ),
      );
    }

    next();
  });
}
