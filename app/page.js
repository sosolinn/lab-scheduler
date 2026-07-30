import fs from "node:fs";
import path from "node:path";

import LegacyScriptRunner from "./LegacyScriptRunner";

export const dynamic = "force-static";

const CO2_CYLINDER_CHECK_TEXT = "CO₂钢瓶气体充足";

function readProjectFile(filename) {
  return fs.readFileSync(path.join(process.cwd(), filename), "utf8");
}

function ensureCo2CylinderMarkup(markup) {
  let result = markup.replaceAll("已勾选 0/15 项", "已勾选 0/16 项");

  if (result.includes(`value="${CO2_CYLINDER_CHECK_TEXT}"`)) {
    return result;
  }

  const temperatureOptionPattern = /(<label class="duty-check-option">\s*<input[^>]*value="温度、CO₂浓度正常，无报警"[^>]*>\s*<span>温度、CO₂浓度正常，无报警<\/span>\s*<\/label>)/;
  const lineBreak = result.includes("\r\n") ? "\r\n" : "\n";
  const indentation = "                  ";
  const cylinderOption = [
    '<label class="duty-check-option">',
    `  <input type="checkbox" class="duty-check-input" name="dutyCheck" value="${CO2_CYLINDER_CHECK_TEXT}">`,
    `  <span>${CO2_CYLINDER_CHECK_TEXT}</span>`,
    "</label>"
  ]
    .map((line, index) => `${index === 0 ? "" : indentation}${line}`)
    .join(lineBreak);

  return result.replace(
    temperatureOptionPattern,
    `$1${lineBreak}${indentation}${cylinderOption}`
  );
}

function applyDisplayTextReplacements(markup) {
  const replacements = [
    [
      '<div class="brand-icon">L</div>',
      '<div class="brand-icon"><img src="/camel-dna-logo.svg" alt="楷模实验室双峰骆驼与 DNA 标志"></div>'
    ],
    ['<p class="eyebrow">实验室公共设备管理</p>', ""],
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

  const replacedMarkup = replacements.reduce(
    (result, [source, replacement]) => result.replaceAll(source, replacement),
    markup
  );

  return ensureCo2CylinderMarkup(replacedMarkup);
}

function ensureCo2CylinderScript(scriptSource) {
  if (scriptSource.includes(`"${CO2_CYLINDER_CHECK_TEXT}"`)) {
    return scriptSource;
  }

  const checklistPattern = /("温度、CO₂浓度正常，无报警",)(\r?\n)(\s*)"培养箱门关闭严密",/;

  return scriptSource.replace(
    checklistPattern,
    (match, temperatureItem, lineBreak, indentation) =>
      `${temperatureItem}${lineBreak}${indentation}"${CO2_CYLINDER_CHECK_TEXT}",${lineBreak}${indentation}"培养箱门关闭严密",`
  );
}

function applyScriptTextReplacements(scriptSource) {
  const replacedScript = scriptSource.replaceAll(
    "完成左侧检查并保存后，记录会显示在这里。",
    "完成检查并保存后，记录会显示在这里。"
  );

  return ensureCo2CylinderScript(replacedScript);
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
  const dutyDatabaseBridge = readProjectFile("duty-database-bridge.js");
  const peoplePickerScript = readProjectFile("people-picker.js");
  const dutyPeopleScript = readProjectFile("duty-people.js");
  const bookingPeopleScript = readProjectFile("booking-people.js");
  const scriptSource = applyScriptTextReplacements(
    `${legacyScript}\n\n${databaseBridge}\n\n${dutyDatabaseBridge}\n\n${peoplePickerScript}\n\n${dutyPeopleScript}\n\n${bookingPeopleScript}`
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
