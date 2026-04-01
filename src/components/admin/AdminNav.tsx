"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "仪表盘" },
  { href: "/admin/personas", label: "人设" },
  { href: "/admin/conversations", label: "对话记录" },
  { href: "/admin/memories", label: "记忆管理" },
  { href: "/admin/memory-performance", label: "性能监控" },
  { href: "/admin/memory-config", label: "系统配置" },
  { href: "/admin/prompts", label: "Prompt 版本" },
  { href: "/admin/testing", label: "测试评估" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-full border px-4 py-2 text-sm transition-colors",
              active
                ? "border-[#bfd8cb] bg-[#edf7f2] text-[#245543]"
                : "border-[#e4ddd2] bg-white/80 text-[#544435] hover:bg-[#f7ede2]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="rounded-full border border-[#d3e3da] bg-[#edf7f2] px-4 py-2 text-sm text-[#245543] transition-colors hover:bg-[#e3f4eb]"
      >
        返回聊天
      </Link>
    </nav>
  );
}
