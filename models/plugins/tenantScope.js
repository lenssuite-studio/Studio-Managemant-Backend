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
  // 🌟 Mongoose 9 query middleware no longer takes a `next` callback — the
  // hook function must return (to proceed) or throw (to reject the query).
  // The old next()/next(error) callback style silently produced
  // "TypeError: next is not a function" on EVERY query against a guarded
  // model, since `next` was simply undefined here — this took down
  // GET /api/Customer/List and every other route on these four models.
  schema.pre(["find", "findOne", "countDocuments"], function () {
    const options = this.getOptions();
    if (options && options.skipTenantGuard) {
      return;
    }

    const filter = this.getQuery();
    if (!filter || !Object.prototype.hasOwnProperty.call(filter, "studioId")) {
      throw new Error(
        `Tenant guard: a "${this.model.modelName}" query is missing studioId in its filter. ` +
          `Add studioId to the query, or if this is a verified superadmin cross-studio read, ` +
          `opt out explicitly with .setOptions({ skipTenantGuard: true }).`,
      );
    }
  });
}
