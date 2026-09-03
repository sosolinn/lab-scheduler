import fs from "node:fs";
import path from "node:path";
import Script from "next/script";

export const dynamic = "force-static";

const CO2_CYLINDER_CHECK_TEXT = "CO₂钢瓶气体充足";
const PIPETTE_TIPS_CHECK_TEXT = "插好 5 mL 与 10 μL 枪头";
const CELL_ROOM_MOPPING_CHECK_TEXT = "细胞房拖地清洁";

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
                <dt>登录用户名</dt>
                <dd id="settingsAccountUsername">—</dd>
              </div>
              <div class="settings-detail-row">
                <dt>账户角色</dt>
                <dd id="settingsAccountRole">—</dd>
              </div>
              <div class="settings-detail-row">
                <dt>认证方式</dt>
                <dd>本地用户名与密码</dd>
              </div>
            </dl>

            <div class="settings-session-actions">
              <button type="button" class="settings-secondary-button" id="settingsLoginButton">
                登录
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
                  <p>修改当前账户的显示姓名</p>
                </div>
              </div>

              <form id="settingsProfileForm">
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
                <p class="settings-help-text">
                  登录用户名由管理员分配，普通用户不能自行修改。
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
                  <p>首次登录或管理员重置密码后，请立即设置自己的新密码</p>
                </div>
              </div>

              <form id="settingsPasswordForm">
                <div class="form-group">
                  <label for="settingsCurrentPassword">当前密码</label>
                  <input
                    type="password"
                    id="settingsCurrentPassword"
                    autocomplete="current-password"
                    placeholder="请输入当前密码"
                    data-settings-auth-required
                  >
                </div>
                <div class="settings-form-grid">
                  <div class="form-group">
                    <label for="settingsNewPassword">新密码</label>
                    <input
                      type="password"
                      id="settingsNewPassword"
                      minlength="8"
                      autocomplete="new-password"
                      placeholder="至少 8 位密码"
                      data-settings-auth-required
                    >
                  </div>
                  <div class="form-group">
                    <label for="settingsConfirmPassword">确认新密码</label>
                    <input
                      type="password"
                      id="settingsConfirmPassword"
                      minlength="8"
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
                密码使用 scrypt 加盐哈希保存在数据库中，系统不会保存或显示明文密码。
              </p>
            </article>

            <article
              class="content-card settings-form-card settings-user-management"
              id="settingsUserManagement"
              hidden
            >
              <div class="card-heading">
                <div>
                  <h3>成员账户管理</h3>
                  <p>仅管理员可创建和重置密码</p>
                </div>
                <button
                  type="button"
                  class="settings-secondary-button settings-refresh-button"
                  id="settingsRefreshUsers"
                >刷新</button>
              </div>

              <form id="settingsCreateUserForm" class="settings-create-user-form">
                <div class="settings-form-grid">
                  <div class="form-group">
                    <label for="settingsNewUsername">登录用户名</label>
                    <input
                      type="text"
                      id="settingsNewUsername"
                      maxlength="32"
                      autocomplete="off"
                      placeholder="例如：xiaoming"
                    >
                  </div>
                  <div class="form-group">
                    <label for="settingsNewUserDisplayName">显示姓名</label>
                    <input
                      type="text"
                      id="settingsNewUserDisplayName"
                      maxlength="30"
                      autocomplete="off"
                      placeholder="例如：小明"
                    >
                  </div>
                  <div class="form-group">
                    <label for="settingsTemporaryPassword">临时密码</label>
                    <input
                      type="password"
                      id="settingsTemporaryPassword"
                      minlength="8"
                      autocomplete="new-password"
                      placeholder="至少 8 位，单独告知本人"
                    >
                  </div>
                  <div class="form-group">
                    <label for="settingsNewUserRole">账户角色</label>
                    <select id="settingsNewUserRole">
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                </div>
                <button type="submit" class="primary-button">创建账户</button>
                <p class="settings-message" id="settingsUsersMessage"></p>
              </form>

              <div class="settings-user-list" id="settingsUserList">
                <div class="settings-user-empty">正在读取账户列表……</div>
              </div>
            </article>
          </div>
        </div>
      </section>`;

function readProjectFile(filename) {
  return fs.readFileSync(path.join(process.cwd(), filename), "utf8");
}

function createDutyOptionMarkup(value, extraClass = "") {
  const className = extraClass
    ? `duty-check-option ${extraClass}`
    : "duty-check-option";

  return `<label class="${className}">
                    <input type="checkbox" class="duty-check-input" name="dutyCheck" value="${value}">
                    <span>${value}</span>
                  </label>`;
}

function ensureDutyMarkup(markup) {
  let result = markup
    .replaceAll("已勾选 0/15 项", "已勾选 0/18 项")
    .replaceAll("已勾选 0/16 项", "已勾选 0/18 项")
    .replace(
      '<label for="dutyAbnormal">7. 异常记录</label>',
      '<label for="dutyAbnormal">异常记录</label>'
    );

  if (!result.includes(`value="${CO2_CYLINDER_CHECK_TEXT}"`)) {
    result = result.replace(
      /(<label class="duty-check-option">\s*<input[^>]*value="温度、CO₂浓度正常，无报警"[^>]*>\s*<span>温度、CO₂浓度正常，无报警<\/span>\s*<\/label>)/,
      `$1\n                  ${createDutyOptionMarkup(CO2_CYLINDER_CHECK_TEXT)}`
    );
  }

  if (!result.includes(`value="${PIPETTE_TIPS_CHECK_TEXT}"`)) {
    result = result.replace(
      /(<label class="duty-check-option">\s*<input[^>]*value="移液器已归位"[^>]*>\s*<span>移液器已归位<\/span>\s*<\/label>)/,
      `$1\n                  ${createDutyOptionMarkup(PIPETTE_TIPS_CHECK_TEXT)}`
    );
  }

  if (!result.includes(`value="${CELL_ROOM_MOPPING_CHECK_TEXT}"`)) {
    const priorityMarkup = `
                <fieldset class="duty-check-group duty-priority-group" aria-label="7. 值日重点：${CELL_ROOM_MOPPING_CHECK_TEXT}">
                  ${createDutyOptionMarkup(CELL_ROOM_MOPPING_CHECK_TEXT, "duty-priority-option")}
                </fieldset>`;

    result = result.replace(
      /(<fieldset class="duty-check-group">\s*<legend>6\. 废弃物处理<\/legend>[\s\S]*?<\/fieldset>)(\s*<\/div>\s*<div class="form-group duty-abnormal-group">)/,
      `$1${priorityMarkup}$2`
    );
  }

  return result;
}

function ensureSettingsMarkup(markup) {
  let result = markup;

  if (!result.includes('data-page="settings"')) {
    result = result.replace(
      /(<button class="nav-item" data-page="duty">[\s\S]*?<\/button>)(\s*<\/nav>)/,
      `$1${SETTINGS_NAV_MARKUP}$2`
    );
  }

  if (!result.includes('id="settings"')) {
    result = result.replace(
      /\s*<\/main>/,
      `${SETTINGS_PAGE_MARKUP}\n    </main>`
    );
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
    ["<p>LabScheduler v1.3</p>", "<p>楷模实验室 v4.0</p>"],
    ["值班人员、完成进度与异常情况", "值日人员、完成进度与异常情况"],
    [
      "设置值日日期和值班人，并勾选已完成或状态正常的项目",
      "设置值日人，勾选已完成或状态正常的项目。"
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

  return ensureSettingsMarkup(ensureDutyMarkup(replacedMarkup));
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

  return (
    <>
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <Script src="/legacy-runtime" strategy="afterInteractive" />
    </>
  );
}
