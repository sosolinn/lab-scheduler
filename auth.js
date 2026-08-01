const __LAB_AUTH_ME_ENDPOINT = "/api/auth/me";
const __LAB_AUTH_LOGIN_ENDPOINT = "/api/auth/login";
const __LAB_AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
const __LAB_OLD_AUTH_SESSION_KEY = "labSchedulerSupabaseAuthSessionV1";

const __labAuthState = {
  ready: false,
  user: null,
  isAdmin: false
};

async function __labAuthReadError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

async function __labAuthFetch(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(
      await __labAuthReadError(response, "身份认证请求失败，请稍后重试。")
    );
  }

  return response.json();
}

function __labAuthDispatch() {
  window.dispatchEvent(
    new CustomEvent("lab:auth-changed", {
      detail: window.__labGetAuthState()
    })
  );
}

function __labAuthSetMessage(message, type = "") {
  const element = document.querySelector("#labAuthMessage");
  if (!element) return;
  element.textContent = message || "";
  element.className = `auth-message${type ? ` ${type}` : ""}`;
}

function __labAuthSetBusy(busy) {
  const button = document.querySelector("#labAuthLoginButton");
  if (button) button.disabled = busy;
}

function __labAuthRender() {
  const name = document.querySelector("#labAuthAccountName");
  const role = document.querySelector("#labAuthAccountRole");
  const avatar = document.querySelector("#labAuthAvatar");
  const logout = document.querySelector("#labAuthLogoutButton");

  if (!name || !role || !avatar || !logout) return;

  if (!__labAuthState.user) {
    name.textContent = "登录";
    role.textContent = "预约和值日操作需登录";
    avatar.textContent = "登";
    logout.hidden = true;
    return;
  }

  const displayName =
    __labAuthState.user.displayName ||
    __labAuthState.user.username ||
    "实验室成员";

  name.textContent = displayName;
  role.textContent = __labAuthState.isAdmin ? "管理员" : "普通用户";
  avatar.textContent = displayName.slice(0, 1).toLocaleUpperCase("zh-CN");
  logout.hidden = false;
}

async function __labAuthReadUser() {
  try {
    const payload = await __labAuthFetch(__LAB_AUTH_ME_ENDPOINT);
    __labAuthState.user = payload.authenticated ? payload.user : null;
    __labAuthState.isAdmin = Boolean(
      payload.authenticated && payload.isAdmin
    );
  } catch (error) {
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
    throw error;
  }
}

async function __labAuthLogin() {
  const username =
    document.querySelector("#labAuthUsername")?.value.trim() || "";
  const password =
    document.querySelector("#labAuthPassword")?.value || "";

  if (!username || password.length < 8) {
    __labAuthSetMessage("请输入用户名和至少 8 位密码。", "error");
    return;
  }

  __labAuthSetBusy(true);
  __labAuthSetMessage("正在登录……");

  try {
    const payload = await __labAuthFetch(__LAB_AUTH_LOGIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    __labAuthState.user = payload.user || null;
    __labAuthState.isAdmin = Boolean(payload.isAdmin);
    __labAuthRender();
    __labAuthDispatch();
    window.__labCloseAuthDialog();

    if (payload.user?.mustChangePassword) {
      document.querySelector('[data-page="settings"]')?.click();
      window.setTimeout(() => {
        const message = document.querySelector("#settingsPasswordMessage");
        if (message) {
          message.textContent = "当前为临时密码，请立即设置新密码。";
          message.className = "settings-message error";
        }
        document.querySelector("#settingsCurrentPassword")?.focus();
      }, 0);
    }
  } catch (error) {
    __labAuthSetMessage(error.message || "登录失败。", "error");
  } finally {
    __labAuthSetBusy(false);
  }
}

async function __labAuthLogout() {
  try {
    await __labAuthFetch(__LAB_AUTH_LOGOUT_ENDPOINT, {
      method: "POST"
    });
  } catch (error) {
    console.warn("服务端退出失败，已清除当前页面状态：", error);
  }

  __labAuthState.user = null;
  __labAuthState.isAdmin = false;
  __labAuthRender();
  __labAuthDispatch();
}

function __labAuthCreateUi() {
  const userInfo = document.querySelector(".user-info");
  if (!userInfo || document.querySelector("#labAuthModal")) return;

  userInfo.classList.add("auth-user-info");
  userInfo.innerHTML = `
    <button type="button" class="auth-account-button" id="labAuthAccountButton">
      <span class="avatar" id="labAuthAvatar">登</span>
      <span class="auth-account-copy">
        <strong id="labAuthAccountName">登录</strong>
        <span id="labAuthAccountRole">预约和值日操作需登录</span>
      </span>
    </button>
    <button type="button" class="auth-logout-button" id="labAuthLogoutButton" hidden>退出</button>
  `;

  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="auth-modal" id="labAuthModal" hidden>
      <button type="button" class="auth-modal-backdrop" data-close-auth aria-label="关闭登录窗口"></button>
      <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="labAuthTitle">
        <button type="button" class="auth-dialog-close" data-close-auth aria-label="关闭">×</button>
        <div class="auth-dialog-heading">
          <span class="auth-dialog-logo">
            <img
              src="/camel-dna-logo.svg"
              alt="楷模实验室双峰骆驼与 DNA 标志"
              style="width:100%;height:100%;display:block;object-fit:contain;border-radius:inherit;"
            >
          </span>
          <div>
            <h3 id="labAuthTitle">登录楷模实验室</h3>
            <p>使用管理员分配的用户名和密码登录。</p>
          </div>
        </div>
        <form id="labAuthForm">
          <label class="auth-field">
            <span>用户名</span>
            <input
              type="text"
              id="labAuthUsername"
              autocomplete="username"
              maxlength="32"
              required
              placeholder="请输入用户名"
            >
          </label>
          <label class="auth-field">
            <span>密码</span>
            <input
              type="password"
              id="labAuthPassword"
              autocomplete="current-password"
              minlength="8"
              required
              placeholder="请输入密码"
            >
          </label>
          <p class="auth-message" id="labAuthMessage"></p>
          <div class="auth-dialog-actions">
            <button
              type="submit"
              class="primary-button"
              id="labAuthLoginButton"
              style="grid-column:1/-1"
            >登录</button>
          </div>
        </form>
        <p class="auth-dialog-note">账户由实验室管理员创建；系统不再依赖邮箱验证。</p>
      </section>
    </div>`
  );

  document
    .querySelector("#labAuthAccountButton")
    ?.addEventListener("click", () => {
      if (!__labAuthState.user) {
        window.__labOpenAuthDialog();
      } else {
        document.querySelector('[data-page="settings"]')?.click();
      }
    });

  document
    .querySelector("#labAuthLogoutButton")
    ?.addEventListener("click", __labAuthLogout);

  document.querySelectorAll("[data-close-auth]").forEach((button) => {
    button.addEventListener("click", () => window.__labCloseAuthDialog());
  });

  document.querySelector("#labAuthForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    __labAuthLogin();
  });
}

window.__labOpenAuthDialog = function () {
  const modal = document.querySelector("#labAuthModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("auth-modal-open");
  __labAuthSetMessage("");
  window.setTimeout(
    () => document.querySelector("#labAuthUsername")?.focus(),
    0
  );
};

window.__labCloseAuthDialog = function () {
  const modal = document.querySelector("#labAuthModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("auth-modal-open");
};

window.__labGetAuthState = function () {
  return {
    ready: __labAuthState.ready,
    user: __labAuthState.user,
    isAdmin: __labAuthState.isAdmin
  };
};

window.__labGetAuthHeaders = async function () {
  await window.__labAuthReady;
  return {};
};

window.__labRefreshAuth = async function () {
  await __labAuthReadUser();
  __labAuthRender();
  __labAuthDispatch();
  return window.__labGetAuthState();
};

async function __labAuthInitialize() {
  __labAuthCreateUi();

  try {
    localStorage.removeItem(__LAB_OLD_AUTH_SESSION_KEY);
  } catch {
    // 浏览器禁用本地存储时不影响 HttpOnly Cookie 登录。
  }

  try {
    await __labAuthReadUser();
  } catch (error) {
    console.warn("初始化本地登录状态失败：", error);
  }

  __labAuthState.ready = true;
  __labAuthRender();
  __labAuthDispatch();
}

window.__labAuthReady = __labAuthInitialize();
