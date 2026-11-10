import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/components/legal/legal-content";

export const metadata: Metadata = { title: "Privacy Policy · ABOT", description: "How ABOT keeps, uses and deletes your data." };

export default function PrivacyPage() {
  return <LegalPage which="privacy" docs={PRIVACY} />;
}
