//#region src/invariant.ts
const name = "everything-oauth-invariant";
const inject = ["invariants"];
const install = () => {};
const apply = (ctx) => Promise.resolve(ctx.invariants.register("dsh-everything-oauth", install));
//#endregion
export { apply, inject, name };
