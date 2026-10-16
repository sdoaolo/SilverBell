"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
    >
      로그아웃
    </Button>
  );
}
