import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { ar } from "./dictionaries/ar";

export type { Dictionary };
export type Namespace = keyof Dictionary;

const dictionaries: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Pick only the namespaces a client subtree needs (keeps RSC payloads small). */
export function pickNamespaces<N extends Namespace>(locale: Locale, namespaces: N[]): Pick<Dictionary, N> {
  const d = dictionaries[locale];
  const out = {} as Pick<Dictionary, N>;
  for (const ns of namespaces) out[ns] = d[ns];
  return out;
}
