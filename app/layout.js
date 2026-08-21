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

export const metadata = {
  title: "楷模实验室预约系统",
  description: "楷模实验室超净台预约与值日管理系统",
  manifest: "/manifest.json",
  icons: {
    icon: "/camel-dna-logo.svg",
    shortcut: "/camel-dna-logo.svg",
    apple: "/camel-dna-logo.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "楷模实验室"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
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
