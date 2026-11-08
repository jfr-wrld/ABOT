"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n";

/** Progress now lives on the Profile page; the old address forwards there. */
export default function ProgressPage() {
  const router = useRouter();
  const t = useT();
  useEffect(() => router.replace("/profile"), [router]);
  return (
    <p role="status" className="px-4 py-10 text-center text-sm text-text-muted">
      {t("Opening Profile")}
    </p>
  );
}
