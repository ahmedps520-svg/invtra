import { WhatsAppSimulator } from "./simulator";

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <WhatsAppSimulator initialPhone={typeof sp.phone === "string" ? sp.phone : null} />;
}
