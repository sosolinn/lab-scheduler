import fs from "node:fs";
import path from "node:path";

import LegacyScriptRunner from "./LegacyScriptRunner";

export const dynamic = "force-static";

const CO2_CYLINDER_CHECK_TEXT = "CO₂钢瓶气体充足";

const SETTINGS_NAV_MARKUP = `
          <button class="nav-item" data-page="settings">
            <span>⚙</span>
            设置
          </button>`;

const SETTINGS_PAGE_MARKUP = `
      <section id="settings" class="page">
        <div class="settings-page-grid">
          <article class="content-card settings-overview-card">
            <div class="card-heading">
              <div>
                <h3>账户状态</h3>
                <p>查看当前账户及登录状态</p>
              </div>
            </div>

            <div class="settings-account-summary">
              <div class="settings-account-avatar" id="settingsAccountAvatar">未</div>
              <div class="settings-account-copy">
                <strong id="settingsAccountName">未登录</strong>
                <p>楷模实验室账户</p>
              </div>
              <span class="settings-status-badge offline" id="settingsLoginStatus">检查中</span>
            </div>

            <dl class="settings-account-details">
              <div class="settings-detail-row">
                <dt>登录邮箱</dt>
                <dd id="settingsAccountEmail">—</dd>
              </div>
              <div class="settings-detail-row">
                <dt>账户角色</dt>
                <dd id="settingsAccountRole">—</dd>
              </div>
              <div class="settings-detail-row">
                <dt>认证方式</dt>
                <dd>Supabase 邮箱与密码</dd>
              </div>
            </dl>

            <div class="settings-session-actions">
              <button type="button" class="settings-secondary-button" id="settingsLoginButton">
                登录 / 注册
              </button>
              <button type="button" class="settings-danger-button" id="settingsLogoutButton" hidden>
                退出当前账户
              </button>
            </div>
          </article>

          <div class="settings-stack">
            <article class="content-card settings-form-card">
              <div class="card-heading">
                <div>
                  <h3>账户资料</h3>
                  <p>修改显示姓名或登录邮箱</p>
                </div>
              </div>

              <form id="settingsProfileForm">
                <div class="settings-form-grid">
                  <div class="form-group">
                    <label for="settingsDisplayName">显示姓名</label>
                    <input
                      type="text"
                      id="settingsDisplayName"
                      maxlength="30"
                      autocomplete="name"
                      placeholder="例如：小明"
                      data-settings-auth-required
                    >
                  </div>
                  <div class="form-group">
                    <label for="settingsEmail">登录邮箱</label>
                    <input
                      type="email"
                      id="settingsEmail"
                      autocomplete="email"
                      placeholder="请输入邮箱"
                      data-settings-auth-required
                    >
                  </div>
                </div>
                <p class="settings-help-text">
                  修改邮箱后，可能需要前往当前邮箱和新邮箱完成确认，具体取决于 Supabase 的认证设置。
                </p>
                <button type="submit" class="primary-button" data-settings-auth-required>
                  保存账户资料
                </button>
                <p class="settings-message" id="settingsProfileMessage"></p>
              </form>
            </article>

            <article class="content-card settings-form-card">
              <div class="card-heading">
                <div>
                  <h3>修改密码</h3>
                  <p>为当前登录账户设置新密码</p>
                </div>
              </div>

              <form id="settingsPasswordForm">
                <div class="settings-form-grid">
                  <div class="form-group">
                    <label for="settingsNewPassword">新密码</label>
                    <input
                      type="password"
                      id="settingsNewPassword"
                      minlength="6"
                      autocomplete="new-password"
                      placeholder="至少 6 位密码"
                      data-settings-auth-required
                    >
                  </div>
                  <div class="form-group">
                    <label for="settingsConfirmPassword">确认新密码</label>
                    <input
                      type="password"
                      id="settingsConfirmPassword"
                      minlength="6"
                      autocomplete="new-password"
                      placeholder="再次输入新密码"
                      data-settings-auth-required
                    >
                  </div>
                </div>
                <button type="submit" class="primary-button" data-settings-auth-required>
                  更新密码
                </button>
                <p class="settings-message" id="settingsPasswordMessage"></p>
              </form>

              <p class="settings-security-note">
                为保护账户安全，系统不会显示或读取原密码。密码由 Supabase Auth 安全保存，此处仅支持设置新密码。
              </p>
            </article>
          </div>
        </div>
      </section>`;

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

function ensureSettingsMarkup(markup) {
  let result = markup;

  if (!result.includes('data-page="settings"')) {
    const dutyNavigationPattern = /(<button class="nav-item" data-page="duty">[\s\S]*?<\/button>)(\s*<\/nav>)/;
    result = result.replace(
      dutyNavigationPattern,
      `$1${SETTINGS_NAV_MARKUP}$2`
    );
  }

  if (!result.includes('id="settings"')) {
    result = result.replace(/\s*<\/main>/, `${SETTINGS_PAGE_MARKUP}\n    </main>`);
  }

  return result;
}

function applyDisplayTextReplacements(markup) {
  const replacements = [
    [
      '<div class="brand-icon">L</div>',
      '<div class="brand-icon"><img src="/camel-dna-logo.svg" alt="楷模实验室双峰骆驼与 DNA 标志"></div>'
    ],
    ['<p class="eyebrow">实验室公共设备管理</p>', ""],
    ["<h1>LabScheduler</h1>", "<h1>楷模实验室</h1>"],
    ["<p>LabScheduler v1.3</p>", "<p>楷模实验室 v2.2</p>"],
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

  return ensureSettingsMarkup(ensureCo2CylinderMarkup(replacedMarkup));
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

function ensureSettingsPageTitle(scriptSource) {
  if (scriptSource.includes('settings: "设置"')) {
    return scriptSource;
  }

  return scriptSource.replace(
    /(const pageTitles = \{[\s\S]*?duty:\s*"值日排班")(\s*\};)/,
    '$1,\n  settings: "设置"$2'
  );
}

function applyScriptTextReplacements(scriptSource) {
  const replacements = [
    [
      "完成左侧检查并保存后，记录会显示在这里。",
      "完成检查并保存后，记录会显示在这里。"
    ],
    [
      '<span class="auth-dialog-logo">楷</span>',
      '<span class="auth-dialog-logo"><img src="/camel-dna-logo.svg" alt="楷模实验室双峰骆驼与 DNA 标志" style="width:100%;height:100%;display:block;object-fit:contain;border-radius:inherit;"></span>'
    ],
    ['placeholder="例如：万家玉"', 'placeholder="例如：小明"'],
    [
      '<p class="auth-dialog-note">管理员由服务器环境变量 LAB_ADMIN_EMAILS 指定。</p>',
      ""
    ]
  ];

  const replacedScript = replacements.reduce(
    (result, [source, replacement]) => result.replaceAll(source, replacement),
    scriptSource
  );

  return ensureSettingsPageTitle(ensureCo2CylinderScript(replacedScript));
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
  const authScript = readProjectFile("auth.js");
  const databaseBridge = readProjectFile("database-bridge.js");
  const dutyDatabaseBridge = readProjectFile("duty-database-bridge.js");
  const peoplePickerScript = readProjectFile("people-picker.js");
  const dutyPeopleScript = readProjectFile("duty-people.js");
  const bookingPeopleScript = readProjectFile("booking-people.js");
  const peoplePickerControlScript = readProjectFile("people-picker-control.js");
  const dutyAuthRulesScript = readProjectFile("duty-auth-rules.js");
  const dutyRulesScript = readProjectFile("duty-rules.js");
  const bookingAuthRulesScript = readProjectFile("booking-auth-rules.js");
  const settingsAccountScript = readProjectFile("settings-account.js");
  const scriptSource = applyScriptTextReplacements(
    `${legacyScript}\n\n${authScript}\n\n${databaseBridge}\n\n${dutyDatabaseBridge}\n\n${peoplePickerScript}\n\n${dutyPeopleScript}\n\n${bookingPeopleScript}\n\n${peoplePickerControlScript}\n\n${dutyAuthRulesScript}\n\n${dutyRulesScript}\n\n${bookingAuthRulesScript}\n\n${settingsAccountScript}`
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
