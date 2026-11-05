import type { ReactNode } from "react";
import { CadreAuth } from "@/components/cadre";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <CadreAuth>{children}</CadreAuth>;
}
