import { common } from "./common";
import { marketing } from "./marketing";
import { auth } from "./auth";
import { dashboard } from "./dashboard";
import { editor } from "./editor";
import { invitation } from "./invitation";
import { themes } from "./themes";

export const en = { common, marketing, auth, dashboard, editor, invitation, themes };
export type Dictionary = typeof en;
