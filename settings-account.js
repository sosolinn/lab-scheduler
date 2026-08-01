const __LAB_SETTINGS_PROFILE_ENDPOINT = "/api/auth/profile";
const __LAB_SETTINGS_PASSWORD_ENDPOINT = "/api/auth/password";
const __LAB_SETTINGS_USERS_ENDPOINT = "/api/admin/users";

function __labSettingsElements() {
  return {
    avatar: document.querySelector("#settingsAccountAvatar"),
    name: document.querySelector("#settingsAccountName"),
    status: document.querySelector("#settingsLoginStatus"),
    username: document.querySelector("#settingsAccountUsername"),
    role: document.querySelector("#settingsAccountRole"),
    profileName: document.querySelector("#settingsDisplayName"),
    loginButton: document.querySelector("#settingsLoginButton"),
    logoutButton: document.querySelector("#settingsLogoutButton"),
    adminSection: document.querySelector("#settingsUserManagement"),
    userList: document.querySelector("#settingsUserList")
  };
}

function __labSettingsSetMessage(selector, message, type = "") {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message || "";
  element.className = `settings-message${type ? ` ${type}` : ""}`;
}

function __labSettingsSetBusy(form, busy) {
  form?.querySelectorAll("button, input, select").forEach((element) => {
    element.disabled = busy;
  });
}

async function __labSettingsReadError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

async function __labSettingsRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(
      await __labSettingsReadError(response, "账户操作失败，请稍后重试。")
    );
  }

  return response.json();
}

function __labSettingsEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function __labSettingsRender() {
  const elements = __labSettingsElements();
  if (!elements.status) return;

  const state = window.__labGetAuthState?.() || {
    ready: false,
    user: null,
    isAdmin: false
  };
  const user = state.user;
  const loggedIn = Boolean(user);
  const displayName =
    user?.displayName || user?.username || "未登录";

  elements.avatar.textContent = loggedIn
    ? displayName.slice(0, 1).toLocaleUpperCase("zh-CN")
    : "未";
  elements.name.textContent = displayName;
  elements.status.textContent = loggedIn
    ? "已登录"
    : state.ready
      ? "未登录"
      : "检查中";
  elements.status.className =
    `settings-status-badge ${loggedIn ? "online" : "offline"}`;
  elements.username.textContent = user?.username || "—";
  elements.role.textContent = loggedIn
    ? state.isAdmin
      ? "管理员"
      : "普通用户"
    : "—";

  if (
    elements.profileName &&
    document.activeElement !== elements.profileName
  ) {
    elements.profileName.value = user?.displayName || "";
  }

  document
    .querySelectorAll("[data-settings-auth-required]")
    .forEach((element) => {
      element.disabled = !loggedIn;
    });

  elements.loginButton.hidden = loggedIn;
  elements.logoutButton.hidden = !loggedIn;
  elements.adminSection.hidden = !state.isAdmin;

  if (state.isAdmin) {
    __labSettingsLoadUsers();
  } else if (elements.userList) {
    elements.userList.innerHTML = "";
  }
}

async function __labSettingsSaveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const state = window.__labGetAuthState?.();
  const displayName =
    document.querySelector("#settingsDisplayName")?.value.trim() || "";

  if (!state?.user) {
    __labSettingsSetMessage(
      "#settingsProfileMessage",
      "请先登录。",
      "error"
    );
    return;
  }

  if (!displayName) {
    __labSettingsSetMessage(
      "#settingsProfileMessage",
      "显示姓名不能为空。",
      "error"
    );
    return;
  }

  __labSettingsSetBusy(form, true);
  __labSettingsSetMessage("#settingsProfileMessage", "正在保存……");

  try {
    await __labSettingsRequest(__LAB_SETTINGS_PROFILE_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName })
    });
    await window.__labRefreshAuth?.();
    __labSettingsSetMessage(
      "#settingsProfileMessage",
      "显示姓名已更新。",
      "success"
    );
  } catch (error) {
    __labSettingsSetMessage(
      "#settingsProfileMessage",
      error.message || "账户资料更新失败。",
      "error"
    );
  } finally {
    __labSettingsSetBusy(form, false);
    __labSettingsRender();
  }
}

async function __labSettingsChangePassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const currentPassword =
    document.querySelector("#settingsCurrentPassword")?.value || "";
  const password =
    document.querySelector("#settingsNewPassword")?.value || "";
  const confirmation =
    document.querySelector("#settingsConfirmPassword")?.value || "";

  if (!window.__labGetAuthState?.().user) {
    __labSettingsSetMessage(
      "#settingsPasswordMessage",
      "请先登录。",
      "error"
    );
    return;
  }

  if (!currentPassword) {
    __labSettingsSetMessage(
      "#settingsPasswordMessage",
      "请输入当前密码。",
      "error"
    );
    return;
  }

  if (password.length < 8) {
    __labSettingsSetMessage(
      "#settingsPasswordMessage",
      "新密码至少需要 8 位。",
      "error"
    );
    return;
  }

  if (password !== confirmation) {
    __labSettingsSetMessage(
      "#settingsPasswordMessage",
      "两次输入的新密码不一致。",
      "error"
    );
    return;
  }

  __labSettingsSetBusy(form, true);
  __labSettingsSetMessage(
    "#settingsPasswordMessage",
    "正在更新密码……"
  );

  try {
    await __labSettingsRequest(__LAB_SETTINGS_PASSWORD_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword: password
      })
    });
    form.reset();
    await window.__labRefreshAuth?.();
    __labSettingsSetMessage(
      "#settingsPasswordMessage",
      "密码已更新，其他设备上的登录会话已退出。",
      "success"
    );
  } catch (error) {
    __labSettingsSetMessage(
      "#settingsPasswordMessage",
      error.message || "密码更新失败。",
      "error"
    );
  } finally {
    __labSettingsSetBusy(form, false);
    __labSettingsRender();
  }
}

function __labSettingsFormatTime(value) {
  if (!value) return "从未登录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function __labSettingsRenderUsers(users) {
  const list = document.querySelector("#settingsUserList");
  if (!list) return;

  if (!Array.isArray(users) || users.length === 0) {
    list.innerHTML = `
      <div class="settings-user-empty">
        暂无账户。请先创建实验室成员账户。
      </div>
    `;
    return;
  }

  list.innerHTML = users
    .map((user) => {
      const id = __labSettingsEscape(user.id);
      const username = __labSettingsEscape(user.username);
      const displayName = __labSettingsEscape(user.displayName);
      const isAdmin = user.role === "admin";
      const disabled = user.status === "disabled";

      return `
        <div class="settings-user-row" data-user-id="${id}">
          <div class="settings-user-main">
            <div class="settings-user-title">
              <strong>${displayName}</strong>
              <span class="settings-user-role ${isAdmin ? "admin" : "member"}">
                ${isAdmin ? "管理员" : "普通用户"}
              </span>
              <span class="settings-user-state ${disabled ? "disabled" : "active"}">
                ${disabled ? "已停用" : "正常"}
              </span>
            </div>
            <p>用户名：${username}</p>
            <p>最近登录：${__labSettingsEscape(
              __labSettingsFormatTime(user.lastLoginAt)
            )}</p>
            ${
              user.mustChangePassword
                ? '<p class="settings-user-warning">首次登录后需要修改密码</p>'
                : ""
            }
          </div>
          <div class="settings-user-actions">
            <button
              type="button"
              class="settings-small-button"
              data-user-action="reset-password"
              data-user-id="${id}"
            >重置密码</button>
            <button
              type="button"
              class="settings-small-button"
              data-user-action="toggle-role"
              data-user-id="${id}"
              data-user-role="${isAdmin ? "user" : "admin"}"
            >${isAdmin ? "设为普通用户" : "设为管理员"}</button>
            <button
              type="button"
              class="settings-small-button ${disabled ? "" : "danger"}"
              data-user-action="toggle-status"
              data-user-id="${id}"
              data-user-active="${disabled ? "true" : "false"}"
            >${disabled ? "启用" : "停用"}</button>
          </div>
        </div>
      `;
    })
    .join("");
}

let __labSettingsUsersLoading = false;

async function __labSettingsLoadUsers() {
  if (__labSettingsUsersLoading) return;
  if (!window.__labGetAuthState?.().isAdmin) return;

  __labSettingsUsersLoading = true;
  try {
    const payload = await __labSettingsRequest(
      __LAB_SETTINGS_USERS_ENDPOINT
    );
    __labSettingsRenderUsers(payload.users || []);
  } catch (error) {
    __labSettingsSetMessage(
      "#settingsUsersMessage",
      error.message || "用户列表加载失败。",
      "error"
    );
  } finally {
    __labSettingsUsersLoading = false;
  }
}

async function __labSettingsCreateUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username =
    document.querySelector("#settingsNewUsername")?.value.trim() || "";
  const displayName =
    document.querySelector("#settingsNewUserDisplayName")?.value.trim() ||
    "";
  const password =
    document.querySelector("#settingsTemporaryPassword")?.value || "";
  const role =
    document.querySelector("#settingsNewUserRole")?.value || "user";

  if (!username || !displayName || password.length < 8) {
    __labSettingsSetMessage(
      "#settingsUsersMessage",
      "请填写用户名、显示姓名和至少 8 位临时密码。",
      "error"
    );
    return;
  }

  __labSettingsSetBusy(form, true);
  __labSettingsSetMessage(
    "#settingsUsersMessage",
    "正在创建账户……"
  );

  try {
    await __labSettingsRequest(__LAB_SETTINGS_USERS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName,
        password,
        role
      })
    });
    form.reset();
    __labSettingsSetMessage(
      "#settingsUsersMessage",
      `账户“${username}”已创建。请将临时密码单独告知本人。`,
      "success"
    );
    await __labSettingsLoadUsers();
  } catch (error) {
    __labSettingsSetMessage(
      "#settingsUsersMessage",
      error.message || "账户创建失败。",
      "error"
    );
  } finally {
    __labSettingsSetBusy(form, false);
  }
}

async function __labSettingsHandleUserAction(event) {
  const button = event.target.closest("[data-user-action]");
  if (!button) return;

  const action = button.dataset.userAction;
  const id = button.dataset.userId;
  const body = { id };

  if (action === "reset-password") {
    const password = window.prompt(
      "请输入新的临时密码（至少 8 位）。该用户下次登录后必须修改密码："
    );
    if (password === null) return;
    if (password.length < 8) {
      __labSettingsSetMessage(
        "#settingsUsersMessage",
        "临时密码至少需要 8 位。",
        "error"
      );
      return;
    }
    body.action = "resetPassword";
    body.password = password;
  } else if (action === "toggle-status") {
    const activate = button.dataset.userActive === "true";
    if (
      !window.confirm(
        activate
          ? "确定启用这个账户吗？"
          : "确定停用这个账户吗？该用户会立即退出登录。"
      )
    ) {
      return;
    }
    body.action = "setStatus";
    body.active = activate;
  } else if (action === "toggle-role") {
    const role = button.dataset.userRole;
    if (
      !window.confirm(
        role === "admin"
          ? "确定将该账户设为管理员吗？管理员可以管理所有用户和预约。"
          : "确定将该账户改为普通用户吗？"
      )
    ) {
      return;
    }
    body.action = "setRole";
    body.role = role;
  } else {
    return;
  }

  button.disabled = true;
  try {
    await __labSettingsRequest(__LAB_SETTINGS_USERS_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    __labSettingsSetMessage(
      "#settingsUsersMessage",
      "账户设置已更新。",
      "success"
    );
    await __labSettingsLoadUsers();
  } catch (error) {
    __labSettingsSetMessage(
      "#settingsUsersMessage",
      error.message || "账户设置更新失败。",
      "error"
    );
  } finally {
    button.disabled = false;
  }
}

function __labSettingsInitialize() {
  const profileForm = document.querySelector("#settingsProfileForm");
  const passwordForm = document.querySelector("#settingsPasswordForm");
  const createUserForm = document.querySelector(
    "#settingsCreateUserForm"
  );

  if (!profileForm || !passwordForm) return;

  profileForm.addEventListener("submit", __labSettingsSaveProfile);
  passwordForm.addEventListener(
    "submit",
    __labSettingsChangePassword
  );
  createUserForm?.addEventListener(
    "submit",
    __labSettingsCreateUser
  );

  document
    .querySelector("#settingsUserList")
    ?.addEventListener("click", __labSettingsHandleUserAction);

  document
    .querySelector("#settingsRefreshUsers")
    ?.addEventListener("click", __labSettingsLoadUsers);

  document
    .querySelector("#settingsLoginButton")
    ?.addEventListener("click", () => {
      window.__labOpenAuthDialog?.();
    });

  document
    .querySelector("#settingsLogoutButton")
    ?.addEventListener("click", () => {
      document.querySelector("#labAuthLogoutButton")?.click();
    });

  window.addEventListener("lab:auth-changed", __labSettingsRender);

  Promise.resolve(window.__labAuthReady)
    .catch(() => null)
    .finally(__labSettingsRender);
}

__labSettingsInitialize();
