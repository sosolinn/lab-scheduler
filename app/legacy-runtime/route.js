import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

const CO2_CYLINDER_CHECK_TEXT = "CO₂钢瓶气体充足";
const PIPETTE_TIPS_CHECK_TEXT = "插好 5 mL 与 10 μL 枪头";
const CELL_ROOM_MOPPING_CHECK_TEXT = "细胞房拖地清洁";

const RUNTIME_FILES = [
  "script.js",
  "auth.js",
  "database-bridge.js",
  "duty-database-bridge.js",
  "people-picker.js",
  "duty-people.js",
  "booking-people.js",
  "people-picker-control.js",
  "duty-auth-rules.js",
  "duty-rules.js",
  "booking-auth-rules.js",
  "settings-account.js"
];

function readProjectFile(filename) {
  return fs.readFileSync(path.join(process.cwd(), filename), "utf8");
}

function ensureCo2CylinderScript(source) {
  if (source.includes(`"${CO2_CYLINDER_CHECK_TEXT}"`)) return source;

  return source.replace(
    /("温度、CO₂浓度正常，无报警",)(\r?\n)(\s*)"培养箱门关闭严密",/,
    (match, temperatureItem, lineBreak, indentation) =>
      `${temperatureItem}${lineBreak}${indentation}"${CO2_CYLINDER_CHECK_TEXT}",${lineBreak}${indentation}"培养箱门关闭严密",`
  );
}

function ensurePipetteTipsScript(source) {
  if (source.includes(`"${PIPETTE_TIPS_CHECK_TEXT}"`)) return source;

  return source.replace(
    /("移液器已归位",)(\s*)"液氮罐液氮充足"/,
    (match, pipetteItem, spacing) =>
      `${pipetteItem}${spacing}"${PIPETTE_TIPS_CHECK_TEXT}",${spacing}"液氮罐液氮充足"`
  );
}

function ensureCellRoomMoppingScript(source) {
  if (source.includes(`"${CELL_ROOM_MOPPING_CHECK_TEXT}"`)) return source;

  return source.replace(
    /(\{\s*title:\s*"6\. 废弃物处理",\s*items:\s*\["废液桶和垃圾袋未过满、无泄漏"\]\s*\})(\s*\];)/,
    `$1,\n  {\n    title: "7. 值日重点",\n    items: ["${CELL_ROOM_MOPPING_CHECK_TEXT}"]\n  }$2`
  );
}

function ensureSettingsPageTitle(source) {
  if (source.includes('settings: "设置"')) return source;

  return source.replace(
    /(const pageTitles = \{[\s\S]*?duty:\s*"值日管理")(\s*\};)/,
    '$1,\n  settings: "设置"$2'
  );
}

function downgradeRecoverableDatabaseLogs(source) {
  const replacements = [
    ["console.error(`添加${labelText}失败：`, error);", "console.warn(`添加${labelText}失败：`, error);"],
    ["console.error(`删除${labelText}失败：`, error);", "console.warn(`删除${labelText}失败：`, error);"],
    ["console.error(`刷新${labelText}名单失败：`, error);", "console.warn(`刷新${labelText}名单失败：`, error);"],
    ["console.error(`初始化${labelText}名单失败：`, error);", "console.warn(`初始化${labelText}名单失败：`, error);"]
  ];

  return replacements.reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    source
  );
}

function buildRuntime() {
  let source = RUNTIME_FILES.map(readProjectFile).join("\n\n;\n\n");

  source = source.replaceAll(
    "完成左侧检查并保存后，记录会显示在这里。",
    "完成检查并保存后，记录会显示在这里。"
  );
  source = ensureCo2CylinderScript(source);
  source = ensurePipetteTipsScript(source);
  source = ensureCellRoomMoppingScript(source);
  source = ensureSettingsPageTitle(source);
  source = downgradeRecoverableDatabaseLogs(source);

  return source;
}

export function GET() {
  return new Response(buildRuntime(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400"
    }
  });
}
