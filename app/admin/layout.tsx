import type { Metadata } from "next";
import { AdminProviders } from "./_components/AdminProviders";

export const metadata: Metadata = {
  title: "Admin — Crime reporting",
  description: "System administration",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminProviders>{children}</AdminProviders>;
}
