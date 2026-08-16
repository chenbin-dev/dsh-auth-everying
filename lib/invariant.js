//#region src/invariant.ts
const name = "dsh-auth-everying-invariant";
const inject = ["invariants"];
const install = () => {};
const apply = (ctx) => Promise.resolve(ctx.invariants.register("dsh-auth-everying", install));
//#endregion
export { apply, inject, name };
