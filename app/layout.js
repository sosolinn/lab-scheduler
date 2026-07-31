import "../style.css";
import "./mobile.css";
import "./mobile-containment.css";
import "./duty-people.css";
import "./compact-header.css";
import "./duty-record-rules.css";
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
      <body>{children}</body>
    </html>
  );
}
