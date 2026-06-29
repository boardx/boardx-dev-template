"use client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button data-testid="logout" onClick={logout}
      className="rounded bg-neutral-200 px-3 py-1 text-sm text-neutral-800">
      登出
    </button>
  );
}
