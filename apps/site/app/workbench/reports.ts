import path from "node:path";

/** tools/e2e/reports, where the harness writes its runs and workbench.json (E2E_REPORTS overrides it). */
export const reportsRoot = () => path.resolve(process.env.E2E_REPORTS ?? path.join(process.cwd(), "../../tools/e2e/reports"));

/** Dev only: the workbench reads files on this machine. */
export const enabled = () => process.env.NODE_ENV === "development";
