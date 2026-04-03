"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections: {
  title: string;
  items: { href: string; label: string; icon: "home" | "users" | "shield" | "map" | "file" | "check" }[];
}[] = [
  {
    title: "Dashboard",
    items: [{ href: "/admin", label: "Overview", icon: "home" }],
  },
  {
    title: "Verifications",
    items: [
      { href: "/admin/verifications/community", label: "Community", icon: "check" },
      { href: "/admin/verifications/police", label: "Police onboarding", icon: "shield" },
    ],
  },
  {
    title: "Directory",
    items: [
      { href: "/admin/users", label: "All users", icon: "users" },
      { href: "/admin/police", label: "Police officers", icon: "shield" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/incidents", label: "Incidents", icon: "file" },
      { href: "/admin/cases", label: "Cases", icon: "file" },
      { href: "/admin/map", label: "Map", icon: "map" },
    ],
  },
];

function Icon({ name }: { name: (typeof sections)[number]["items"][number]["icon"] }) {
  const cls = "h-4 w-4 shrink-0 text-slate-500 group-[.active]:text-blue-700";
  switch (name) {
    case "home":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "users":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "shield":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "map":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
    case "file":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "check":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[4px_0_24px_-12px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 px-5 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
            AD
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Console</p>
            <p className="text-base font-semibold tracking-tight text-slate-900">Administration</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{section.title}</p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "active bg-blue-50 text-blue-900 shadow-sm ring-1 ring-blue-100/80"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Crime reporting · System tools for operators only.
        </p>
      </div>
    </aside>
  );
}
