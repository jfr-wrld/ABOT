"use client";

import { useEffect } from "react";
import { startApp } from "@/store/appSession";

/** Starts storage, hydration and persistence once per tab (see store/appSession). */
export function StoreHydrator() {
  useEffect(() => {
    void startApp();
  }, []);
  return null;
}
