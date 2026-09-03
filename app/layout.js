import Script from "next/script";

import "../style.css";
import "./mobile.css";
import "./mobile-containment.css";
import "./mobile-interaction.css";
import "./android-time-picker.css";
import "./today-booking-view.css";
import "./past-booking-collapse.css";
import "./duty-week-display.css";
import "./duty-people.css";
import "./duty-priority.css";
import "./form-control-icons.css";
import "./compact-header.css";
import "./duty-record-rules.css";
import "./duty-month-view.css";
import "./auth.css";
import "./auth-overrides.css";
import "./settings.css";
import "./apple-ui.css";

export const metadata = {
  title: "楷模实验室预约系统",
  description: "楷模实验室超净台预约与值日管理系统",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "楷模实验室"
  }
};

const SPLASH_STYLES = `
  #labStartupSplash {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #1f3f7a;
    opacity: 1;
    visibility: visible;
    transition: opacity 220ms ease, visibility 220ms ease;
  }

  #labStartupSplash img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #1f3f7a;
  }

  #labStartupSplash.is-hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    #labStartupSplash {
      transition: none;
    }
  }
`;

const SPLASH_CONTROLLER = `
  (() => {
    const startedAt = performance.now();
    let dismissScheduled = false;

    function dismissSplash() {
      if (dismissScheduled) return;
      dismissScheduled = true;

      const elapsed = performance.now() - startedAt;
      const delay = Math.max(0, 220 - elapsed);

      window.setTimeout(() => {
        const splash = document.getElementById("labStartupSplash");
        if (!splash) return;

        splash.classList.add("is-hidden");
        window.setTimeout(() => splash.remove(), 260);
      }, delay);
    }

    window.addEventListener("lab:app-ready", dismissSplash, { once: true });
    window.addEventListener("load", () => window.setTimeout(dismissSplash, 80), { once: true });
    window.setTimeout(dismissSplash, 1800);
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/splash-screen.svg"
          as="image"
          type="image/svg+xml"
        />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_STYLES }} />
        <Script id="lab-splash-controller" strategy="beforeInteractive">
          {SPLASH_CONTROLLER}
        </Script>
      </head>
      <body>
        <div id="labStartupSplash" aria-hidden="true">
          <img
            src="/splash-screen.svg"
            alt=""
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
        </div>
        <Script src="/pwa-register.js" strategy="afterInteractive" />
        <Script src="/pwa-install.js" strategy="afterInteractive" />
        <Script src="/mobile-post-login-tap.js" strategy="beforeInteractive" />
        {children}
        <Script src="/account-name-merge.js" strategy="afterInteractive" />
        <Script src="/interface-cleanup.js" strategy="afterInteractive" />
        <Script src="/duty-month-view.js" strategy="afterInteractive" />
        <Script src="/dashboard-detail-jump.js" strategy="afterInteractive" />
        <Script src="/android-time-picker.js" strategy="afterInteractive" />
        <Script src="/today-booking-view.js" strategy="afterInteractive" />
        <Script src="/past-booking-collapse.js" strategy="afterInteractive" />
        <Script src="/duty-week-display.js" strategy="afterInteractive" />
        <Script src="/mobile-header-login.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
