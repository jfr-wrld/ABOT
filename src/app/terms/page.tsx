import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS } from "@/components/legal/legal-content";

export const metadata: Metadata = { title: "Terms of Use · ABOT", description: "The terms for using ABOT and buying ABOT // BLACK PRO." };

export default function TermsPage() {
  return <LegalPage which="terms" docs={TERMS} />;
}
