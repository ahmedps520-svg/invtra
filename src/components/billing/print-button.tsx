"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
