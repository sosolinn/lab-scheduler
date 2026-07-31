const __LAB_SETTINGS_CONFIG_ENDPOINT = "/api/auth/config";
let __labSettingsConfig = null;

function __labSettingsElements() {
  return {
    avatar: document.querySelector("#settingsAccountAvatar"),
    name: document.querySelector("#settingsAccountName"),
    status: document.querySelector("#settingsLoginStatus"),
    email: document.querySelector("#settingsAccountEmail"),
    role: document.querySelector("#settingsAccountRole"),
    profileName: document.querySelector("#settingsDisplayName"),
    profileEmail: document.querySelector("#settingsEmail"),
    loginButton: document.querySelector("#settingsLoginButton"),
    logoutButton: document.querySelector("#settingsLogoutButton")
  };
}

function __labSettingsSetMessage(selector, message, type = "") {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message || "";
  element.className = `settings-message${type ? ` ${type}` : ""}`;
}

function __labSettingsSetBusy(form, busy) {
  form?.querySelectorAll("button, input").forEach((element) => {
    element.disabled = busy;
  });
}

async function __labSettingsReadError(response, fallback) {
  try {
    const payload = await response.json();
    return (
      payload.error_description ||
      payload.msg ||
      payload.message ||
      payload.error ||
      fallback
    );
  } catch {
    return fallback;
  }
}

async function __labSettingsLoadConfig() {
  if (__labSettingsConfig) return __labSettingsConfig;
  const response = await fetch(__LAB_SETTINGS_CONFIG_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(await __labSettingsReadError(response, "Supabase Auth 尚未配置。"));
  }
  __labSettingsConfig = await response.json();
  return __labSettingsConfig;
}

async function __labSettingsUpdateUser(attributes) {
  const [config, authHeaders] = await Promise.all([
    __labSettingsLoadConfig(),
    window.__labGetAuthHeaders?.()
  ]);

  if (!authHeaders?.Authorization) {
    throw new Error("请先登录后再修改账户设置。");
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: config.publishableKey,
      ...authHeaders,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(attributes)
  });

  if (!response.ok) {
    throw new Error(await __labSettingsReadError(response, "账户信息更新失败。"));
  }

  return response.json();
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
  const displayName = user?.displayName || user?.email || "未登录";

  elements.avatar.textContent = loggedIn
    ? displayName.slice(0, 1).toLocaleUpperCase("zh-CN")
    : "未";
  elements.name.textContent = displayName;
  elements.status.textContent = loggedIn ? "已登录" : state.ready ? "未登录" : "检查中";
  elements.status.className = `settings-status-badge ${loggedIn ? "online" : "offline"}`;
  elements.email.textContent = user?.email || "—";
  elements.role.textContent = loggedIn
    ? state.isAdmin
      ? "管理员"
      : "普通用户"
    : "—";

  if (elements.profileName && document.activeElement !== elements.profileName) {
    elements.profileName.value = user?.displayName || "";
  }
  if (elements.profileEmail && document.activeElement !== elements.profileEmail) {
    elements.profileEmail.value = user?.email || "";
  }

  document.querySelectorAll("[data-settings-auth-required]").forEach((element) => {
    element.disabled = !loggedIn;
  });

  elements.loginButton.hidden = loggedIn;
  elements.logoutButton.hidden = !loggedIn;
}

function __labSettingsSyncTopbar(displayName) {
  const accountName = document.querySelector("#labAuthAccountName");
  const avatar = document.querySelector("#labAuthAvatar");
  if (accountName) accountName.textContent = displayName;
  if (avatar) avatar.textContent = displayName.slice(0, 1).toLocaleUpperCase("zh-CN");
}

async function __labSettingsSaveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const state = window.__labGetAuthState?.();
  const user = state?.user;
  const displayName = document.querySelector("#settingsDisplayName")?.value.trim() || "";
  const email = document.querySelector("#settingsEmail")?.value.trim() || "";

  if (!user) {
    __labSettingsSetMessage("#settingsProfileMessage", "请先登录。", "error");
    return;
  }
  if (!displayName) {
    __labSettingsSetMessage("#settingsProfileMessage", "显示姓名不能为空。", "error");
    return;
  }
  if (!email || !email.includes("@")) {
    __labSettingsSetMessage("#settingsProfileMessage", "请输入有效邮箱。", "error");
    return;
  }

  const attributes = {};
  const nameChanged = displayName !== (user.displayName || "");
  const emailChanged = email.toLocaleLowerCase("en-US") !== user.email;
  if (nameChanged) attributes.data = { display_name: displayName };
  if (emailChanged) attributes.email = email;

  if (!nameChanged && !emailChanged) {
    __labSettingsSetMessage("#settingsProfileMessage", "账户信息没有变化。", "success");
    return;
  }

  __labSettingsSetBusy(form, true);
  __labSettingsSetMessage("#settingsProfileMessage", "正在保存……");
  try {
    await __labSettingsUpdateUser(attributes);
    if (nameChanged) {
      user.displayName = displayName;
      __labSettingsSyncTopbar(displayName);
    }
    __labSettingsRender();
    __labSettingsSetMessage(
      "#settingsProfileMessage",
      emailChanged
        ? "资料已保存。邮箱变更需按 Supabase 发送的邮件完成确认。"
        : "显示姓名已更新。",
      "success"
    );
  } catch (error) {
    __labSettingsSetMessage(
      "#settingsProfileMessage",
      error.message || "账户信息更新失败。",
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
  const password = document.querySelector("#settingsNewPassword")?.value || "";
  const confirmation = document.querySelector("#settingsConfirmPassword")?.value || "";

  if (!window.__labGetAuthState?.().user) {
    __labSettingsSetMessage("#settingsPasswordMessage", "请先登录。", "error");
    return;
  }
  if (password.length < 6) {
    __labSettingsSetMessage("#settingsPasswordMessage", "新密码至少需要 6 位。", "error");
    return;
  }
  if (password !== confirmation) {
    __labSettingsSetMessage("#settingsPasswordMessage", "两次输入的密码不一致。", "error");
    return;
  }

  __labSettingsSetBusy(form, true);
  __labSettingsSetMessage("#settingsPasswordMessage", "正在更新密码……");
  try {
    await __labSettingsUpdateUser({ password });
    form.reset();
    __labSettingsSetMessage("#settingsPasswordMessage", "密码已更新。", "success");
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

function __labSettingsInitialize() {
  const profileForm = document.querySelector("#settingsProfileForm");
  const passwordForm = document.querySelector("#settingsPasswordForm");
  if (!profileForm || !passwordForm) return;

  profileForm.addEventListener("submit", __labSettingsSaveProfile);
  passwordForm.addEventListener("submit", __labSettingsChangePassword);
  document.querySelector("#settingsLoginButton")?.addEventListener("click", () => {
    window.__labOpenAuthDialog?.();
  });
  document.querySelector("#settingsLogoutButton")?.addEventListener("click", () => {
    document.querySelector("#labAuthLogoutButton")?.click();
  });
  window.addEventListener("lab:auth-changed", __labSettingsRender);

  Promise.resolve(window.__labAuthReady)
    .catch(() => null)
    .finally(__labSettingsRender);
}

__labSettingsInitialize();
