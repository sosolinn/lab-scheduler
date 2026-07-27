"use client";

import { useEffect } from "react";

const INITIALIZED_FLAG = "__LAB_SCHEDULER_LEGACY_INITIALIZED__";

export default function LegacyScriptRunner({ source }) {
  useEffect(() => {
    if (window[INITIALIZED_FLAG]) {
      return;
    }

    window[INITIALIZED_FLAG] = true;

    const script = document.createElement("script");
    script.setAttribute("data-lab-scheduler-runtime", "true");
    script.textContent = source;
    document.body.appendChild(script);
  }, [source]);

  return null;
}
