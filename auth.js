const __LAB_AUTH_SESSION_KEY = "labSchedulerSupabaseAuthSessionV1";
const __LAB_AUTH_CONFIG_ENDPOINT = "/api/auth/config";
const __LAB_AUTH_ME_ENDPOINT = "/api/auth/me";

let __labAuthConfig = null;
let __labAuthRefreshPromise = null;
const __labAuthState = {
  ready: false,
  session: null,
  user: null,
  isAdmin: false
};

function __labAuthReadSession() {
  try {
    const value = localStorage.getItem(__LAB_AUTH_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function __labAuthStoreSession(session) {
  __labAuthState.session = session || null;
  if (session) {
    localStorage.setItem(__LAB_AUTH_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(__LAB_AUTH_SESSION_KEY);
  }
}

function __labAuthNormalizeSession(payload) {
  if (!payload?.access_token || !payload?.refresh_token) {
    return null;
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at:
      Number(payload.expires_at) ||
      Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600)
  };
}

async function __labAuthError(response, fallback) {
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

async function __labAuthLoadConfig() {
  if (__labAuthConfig) {
    return __labAuthConfig;
  }
  const response = await fetch(__LAB_AUTH_CONFIG_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(await __labAuthError(response, "Supabase Auth 尚未配置。"));
  }
  __labAuthConfig = await response.json();
  return __labAuthConfig;
}

async function __labAuthRequest(path, body, accessToken = "") {
  const config = await __labAuthLoadConfig();
  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken || config.publishableKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body || {})
  });
  if (!response.ok) {
    throw new Error(await __labAuthError(response, "身份认证请求失败。"));
  }
  return response.json();
}

async function __labAuthRefresh() {
  if (!__labAuthState.session?.refresh_token) {
    return null;
  }
  if (__labAuthRefreshPromise) {
    return __labAuthRefreshPromise;
  }
  __labAuthRefreshPromise = (async () => {
    try {
      const payload = await __labAuthRequest(
        "/auth/v1/token?grant_type=refresh_token",
        { refresh_token: __labAuthState.session.refresh_token }
      );
      const session = __labAuthNormalizeSession(payload);
      if (!session) {
        throw new Error("登录已失效，请重新登录。");
      }
      __labAuthStoreSession(session);
      return session;
    } catch (error) {
      __labAuthStoreSession(null);
      __labAuthState.user = null;
      __labAuthState.isAdmin = false;
      throw error;
    } finally {
      __labAuthRefreshPromise = null;
    }
  })();
  return __labAuthRefreshPromise;
}

async function __labAuthFreshSession() {
  const session = __labAuthState.session;
  if (!session?.access_token) {
    return null;
  }
  if (Number(session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60) {
    return session;
  }
  return __labAuthRefresh();
}

async function __labAuthReadUser() {
  const session = await __labAuthFreshSession();
  if (!session) {
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
    return;
  }
  const response = await fetch(__LAB_AUTH_ME_ENDPOINT, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`
    }
  });
  if (!response.ok) {
    throw new Error(await __labAuthError(response, "无法验证当前用户。"));
  }
  const payload = await response.json();
  __labAuthState.user = payload.authenticated ? payload.user : null;
  __labAuthState.isAdmin = Boolean(payload.authenticated && payload.isAdmin);
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
  if (element) {
    element.textContent = message || "";
    element.className = `auth-message${type ? ` ${type}` : ""}`;
  }
}

function __labAuthSetBusy(busy) {
  ["#labAuthLoginButton", "#labAuthRegisterButton"].forEach((selector) => {
    const button = document.querySelector(selector);
    if (button) button.disabled = busy;
  });
}

function __labAuthRender() {
  const name = document.querySelector("#labAuthAccountName");
  const role = document.querySelector("#labAuthAccountRole");
  const avatar = document.querySelector("#labAuthAvatar");
  const logout = document.querySelector("#labAuthLogoutButton");
  if (!name || !role || !avatar || !logout) return;

  if (!__labAuthState.user) {
    name.textContent = "登录 / 注册";
    role.textContent = "预约操作需登录";
    avatar.textContent = "登";
    logout.hidden = true;
    return;
  }

  const displayName =
    __labAuthState.user.displayName || __labAuthState.user.email || "实验室成员";
  name.textContent = displayName;
  role.textContent = __labAuthState.isAdmin ? "管理员" : "普通用户";
  avatar.textContent = displayName.slice(0, 1).toLocaleUpperCase("zh-CN");
  logout.hidden = false;
}

async function __labAuthComplete(payload) {
  const session = __labAuthNormalizeSession(payload);
  if (!session) {
    throw new Error("未收到有效登录会话，请确认邮箱后再登录。");
  }
  __labAuthStoreSession(session);
  await __labAuthReadUser();
  __labAuthRender();
  __labAuthDispatch();
  window.__labCloseAuthDialog();
}

async function __labAuthLogin() {
  const email = document.querySelector("#labAuthEmail")?.value.trim() || "";
  const password = document.querySelector("#labAuthPassword")?.value || "";
  if (!email || password.length < 6) {
    __labAuthSetMessage("请输入有效邮箱和至少 6 位密码。", "error");
    return;
  }
  __labAuthSetBusy(true);
  __labAuthSetMessage("正在登录……");
  try {
    const payload = await __labAuthRequest(
      "/auth/v1/token?grant_type=password",
      { email, password }
    );
    await __labAuthComplete(payload);
  } catch (error) {
    __labAuthSetMessage(error.message || "登录失败。", "error");
  } finally {
    __labAuthSetBusy(false);
  }
}

async function __labAuthRegister() {
  const email = document.querySelector("#labAuthEmail")?.value.trim() || "";
  const password = document.querySelector("#labAuthPassword")?.value || "";
  const displayName =
    document.querySelector("#labAuthDisplayName")?.value.trim() || "";
  if (!email || password.length < 6) {
    __labAuthSetMessage("请输入有效邮箱和至少 6 位密码。", "error");
    return;
  }
  __labAuthSetBusy(true);
  __labAuthSetMessage("正在创建账户……");
  try {
    const payload = await __labAuthRequest("/auth/v1/signup", {
      email,
      password,
      data: { display_name: displayName }
    });
    if (payload?.access_token) {
      await __labAuthComplete(payload);
    } else {
      __labAuthSetMessage(
        "账户已创建。请前往邮箱完成确认，然后返回登录。",
        "success"
      );
    }
  } catch (error) {
    __labAuthSetMessage(error.message || "注册失败。", "error");
  } finally {
    __labAuthSetBusy(false);
  }
}

function __labAuthCreateUi() {
  const userInfo = document.querySelector(".user-info");
  if (!userInfo || document.querySelector("#labAuthModal")) return;

  userInfo.classList.add("auth-user-info");
  userInfo.innerHTML = `
    <button type="button" class="auth-account-button" id="labAuthAccountButton">
      <span class="avatar" id="labAuthAvatar">登</span>
      <span class="auth-account-copy">
        <strong id="labAuthAccountName">登录 / 注册</strong>
        <span id="labAuthAccountRole">预约操作需登录</span>
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
          <span class="auth-dialog-logo">楷</span>
          <div><h3 id="labAuthTitle">登录楷模实验室</h3><p>登录后可创建预约，并仅管理本人预约。</p></div>
        </div>
        <form id="labAuthForm">
          <label class="auth-field"><span>邮箱</span><input type="email" id="labAuthEmail" autocomplete="email" required placeholder="请输入邮箱"></label>
          <label class="auth-field"><span>密码</span><input type="password" id="labAuthPassword" autocomplete="current-password" minlength="6" required placeholder="至少 6 位密码"></label>
          <label class="auth-field"><span>显示姓名（注册时可填）</span><input type="text" id="labAuthDisplayName" maxlength="30" autocomplete="name" placeholder="例如：万家玉"></label>
          <p class="auth-message" id="labAuthMessage"></p>
          <div class="auth-dialog-actions">
            <button type="submit" class="primary-button" id="labAuthLoginButton">登录</button>
            <button type="button" class="auth-register-button" id="labAuthRegisterButton">注册账户</button>
          </div>
        </form>
        <p class="auth-dialog-note">管理员由服务器环境变量 LAB_ADMIN_EMAILS 指定。</p>
      </section>
    </div>`
  );

  document.querySelector("#labAuthAccountButton")?.addEventListener("click", () => {
    if (!__labAuthState.user) window.__labOpenAuthDialog();
  });
  document.querySelector("#labAuthLogoutButton")?.addEventListener("click", async () => {
    const session = __labAuthState.session;
    try {
      if (session?.access_token) {
        const config = await __labAuthLoadConfig();
        await fetch(`${config.url}/auth/v1/logout`, {
          method: "POST",
          headers: {
            apikey: config.publishableKey,
            Authorization: `Bearer ${session.access_token}`
          }
        });
      }
    } catch (error) {
      console.warn("远程退出失败，已清除本地会话：", error);
    }
    __labAuthStoreSession(null);
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
    __labAuthRender();
    __labAuthDispatch();
  });
  document.querySelectorAll("[data-close-auth]").forEach((button) =>
    button.addEventListener("click", () => window.__labCloseAuthDialog())
  );
  document.querySelector("#labAuthForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    __labAuthLogin();
  });
  document.querySelector("#labAuthRegisterButton")?.addEventListener("click", __labAuthRegister);
}

window.__labOpenAuthDialog = function () {
  const modal = document.querySelector("#labAuthModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("auth-modal-open");
  __labAuthSetMessage("");
  window.setTimeout(() => document.querySelector("#labAuthEmail")?.focus(), 0);
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
  const session = await __labAuthFreshSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
};

async function __labAuthInitialize() {
  __labAuthCreateUi();
  __labAuthStoreSession(__labAuthReadSession());
  try {
    if (__labAuthState.session) {
      await __labAuthReadUser();
    } else {
      await __labAuthLoadConfig();
    }
  } catch (error) {
    console.error("初始化登录状态失败：", error);
    __labAuthStoreSession(null);
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
  }
  __labAuthState.ready = true;
  __labAuthRender();
  __labAuthDispatch();
}

window.__labAuthReady = __labAuthInitialize();
