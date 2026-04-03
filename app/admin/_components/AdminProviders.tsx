"use client";

import type { ReactNode } from "react";
import { AdminSessionProvider } from "../_lib/admin-session";
import { AdminShell } from "./AdminShell";

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
