import fs from "node:fs";
import path from "node:path";

import LegacyScriptRunner from "./LegacyScriptRunner";

export const dynamic = "force-static";

function readProjectFile(filename) {
  return fs.readFileSync(path.join(process.cwd(), filename), "utf8");
}

function applyDisplayTextReplacements(markup) {
  const replacements = [
    [
      '<div class="brand-icon">L</div>',
      '<div class="brand-icon"><img src="/camel-dna-logo.svg" alt="楷模实验室双峰骆驼与 DNA 标志"></div>'
    ],
    ["<h1>LabScheduler</h1>", "<h1>楷模实验室</h1>"],
    ["<p>LabScheduler v1.3</p>", "<p>楷模实验室 v1.3</p>"],
    ["值班人员、完成进度与异常情况", "值日人员、完成进度与异常情况"],
    [
      "设置值日日期和值班人，并勾选已完成或状态正常的项目",
      "设置值日日期和值日人，并勾选已完成或状态正常的项目"
    ],
    [
      '<label for="dutyName">值班人</label>',
      '<label for="dutyName">值日人</label>'
    ],
    ["请输入值班人姓名", "请输入值日人姓名"],
    ["查看值班人员、完成情况和异常记录", "查看值日人员、完成情况和异常记录"]
  ];

  return replacements.reduce(
    (result, [source, replacement]) => result.replaceAll(source, replacement),
    markup
  );
}

function applyScriptTextReplacements(scriptSource) {
  return scriptSource.replaceAll(
    "完成左侧检查并保存后，记录会显示在这里。",
    "完成检查并保存后，记录会显示在这里。"
  );
}

function getLegacyMarkup() {
  const html = readProjectFile("index.html");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (!bodyMatch) {
    throw new Error("无法从 index.html 中读取页面主体内容。");
  }

  const markup = bodyMatch[1].replace(
    /\s*<script[^>]*src=["']script\.js["'][^>]*><\/script>\s*/i,
    ""
  );

  return applyDisplayTextReplacements(markup);
}

export default function HomePage() {
  const markup = getLegacyMarkup();
  const legacyScript = readProjectFile("script.js");
  const databaseBridge = readProjectFile("database-bridge.js");
  const scriptSource = applyScriptTextReplacements(
    `${legacyScript}\n\n${databaseBridge}`
  );

  return (
    <>
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <LegacyScriptRunner source={scriptSource} />
    </>
  );
}
