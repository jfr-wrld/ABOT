import type { Metadata } from "next";
import { AboutPage } from "@/components/legal/AboutPage";

export const metadata: Metadata = {
  title: "About ABOT",
  description: "ABOT is a strength training log for your phone: log sets, rest on a timer, and track your records.",
};

export default function About() {
  return <AboutPage />;
}
