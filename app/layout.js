import "../style.css";
import "./mobile.css";
import "./mobile-containment.css";

export const metadata = {
  title: "LabScheduler 实验室预约系统",
  description: "实验室超净台预约与值日管理系统"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
