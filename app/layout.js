import Script from "next/script";

import "../style.css";
import "./mobile.css";
import "./mobile-containment.css";
import "./mobile-interaction.css";
import "./duty-people.css";
import "./compact-header.css";
import "./duty-record-rules.css";
import "./duty-month-view.css";
import "./auth.css";
import "./auth-overrides.css";
import "./settings.css";

export const metadata = {
  title: "楷模实验室预约系统",
  description: "楷模实验室超净台预约与值日管理系统",
  icons: {
    icon: "/camel-dna-logo.svg",
    shortcut: "/camel-dna-logo.svg",
    apple: "/camel-dna-logo.svg"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <Script src="/mobile-post-login-tap.js" strategy="beforeInteractive" />
        {children}
        <Script src="/account-name-merge.js" strategy="afterInteractive" />
        <Script src="/interface-cleanup.js" strategy="afterInteractive" />
        <Script src="/duty-month-view.js" strategy="afterInteractive" />
        <Script src="/dashboard-detail-jump.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
