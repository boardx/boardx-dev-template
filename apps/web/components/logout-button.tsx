"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <Button data-testid="logout" variant="secondary" size="sm" onClick={logout}>
      登出
    </Button>
  );
}
