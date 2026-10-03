import { env } from "@/server/env";

export interface CompanyDetails {
  name: string | null;
  cr: string | null;
  vat: string | null;
  address: string | null;
}

/** The business behind INVTRA, from LEGAL_* settings — null until any of them is set. */
export function companyDetails(): CompanyDetails | null {
  const e = env();
  const c = {
    name: e.LEGAL_ENTITY_NAME?.trim() || null,
    cr: e.LEGAL_CR_NUMBER?.trim() || null,
    vat: e.LEGAL_VAT_NUMBER?.trim() || null,
    address: e.LEGAL_ADDRESS?.trim() || null,
  };
  return c.name || c.cr || c.vat || c.address ? c : null;
}
