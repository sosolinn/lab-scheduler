const __LAB_AUTH_SESSION_KEY = "labSchedulerSupabaseAuthSessionV1";
const __LAB_AUTH_CONFIG_ENDPOINT = "/api/auth/config";
const __LAB_AUTH_ME_ENDPOINT = "/api/auth/me";

let __labAuthConfig = null;
let __labAuthRefreshPromise = null;
let __labAuthState = {
  ready: false,
  session: null,
  user: null,
  isAdmin: false
};

function __labReadStoredAuthSession() {
  try {
    const value = localStorage.getItem(__LAB_AUTH_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("读取登录状态失败：", error);
    return null;
  }
}

function __labSaveAuthSession(session) {
  __labAuthState.session = session || null;
  if (session) {
    localStorage.setItem(__LAB_AUTH_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(__LAB_AUTH_SESSION_KEY);
  }
}

function __labNormalizeAuthSession(payload) {
  if (!payload?.access_token || !payload?.refresh_token) {
    return null;
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || "bearer",
    expires_at:
      Number(payload.expires_at) ||
      Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    user: payload.user || null
  };
}

async function __labReadJsonError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return (
      payload.error_description ||
      payload.msg ||
      payload.message ||
      payload.error ||
      fallbackMessage
    );
  } catch {
    return fallbackMessage;
  }
}

async function __labLoadAuthConfig() {
  if (__labAuthConfig) {
    return __labAuthConfig;
  }

  const response = await fetch(__LAB_AUTH_CONFIG_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(
      await __labReadJsonError(response, "Supabase Auth 尚未配置。")
    );
  }

  __labAuthConfig = await response.json();
  return __labAuthConfig;
}

async function __labSupabaseAuthRequest(path, body, accessToken = "") {
  const config = await __labLoadAuthConfig();
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
    throw new Error(await __labReadJsonError(response, "身份认证请求失败。"));
  }

  return response.json();
}

async function __labRefreshAuthSession() {
  const currentSession = __labAuthState.session;
  if (!currentSession?.refresh_token) {
    return null;
  }

  if (__labAuthRefreshPromise) {
    return __labAuthRefreshPromise;
  }

  __labAuthRefreshPromise = (async () => {
    try {
      const payload = await __labSupabaseAuthRequest(
        "/auth/v1/token?grant_type=refresh_token",
        { refresh_token: currentSession.refresh_token }
      );
      const session = __labNormalizeAuthSession(payload);
      if (!session) {
        throw new Error("登录会话刷新失败。请重新登录。");
      }
      __labSaveAuthSession(session);
      return session;
    } catch (error) {
      __labSaveAuthSession(null);
      __labAuthState.user = null;
      __labAuthState.isAdmin = false;
      throw error;
    } finally {
      __labAuthRefreshPromise = null;
    }
  })();

  return __labAuthRefreshPromise;
}

async function __labEnsureFreshAuthSession() {
  const session = __labAuthState.session;
  if (!session?.access_token) {
    return null;
  }

  const expiresAt = Number(session.expires_at || 0);
  if (expiresAt > Math.floor(Date.now() / 1000) + 60) {
    return session;
  }

  return __labRefreshAuthSession();
}

async function __labFetchCurrentUser() {
  const session = await __labEnsureFreshAuthSession();
  if (!session?.access_token) {
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
    return null;
  }

  let response = await fetch(__LAB_AUTH_ME_ENDPOINT, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (response.status === 401 && session.refresh_token) {
    const refreshedSession = await __labRefreshAuthSession();
    response = await fetch(__LAB_AUTH_ME_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${refreshedSession.access_token}`
      }
    });
  }

  if (!response.ok) {
    throw new Error(await __labReadJsonError(response, "无法验证当前用户。"));
  }

  const payload = await response.json();
  __labAuthState.user = payload.authenticated ? payload.user : null;
  __labAuthState.isAdmin = Boolean(payload.authenticated && payload.isAdmin);
  return __labAuthState.user;
}

function __labDispatchAuthChanged() {
  window.dispatchEvent(
    new CustomEvent("lab:auth-changed", {
      detail: {
        ready: __labAuthState.ready,
        user: __labAuthState.user,
        isAdmin: __labAuthState.isAdmin
      }
    })
  );
}

function __labCreateAuthUi() {
  const userInfo = document.querySelector(".user-info");
  if (!userInfo || document.querySelector("#labAuthModal")) {
    return;
  }

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
    `
      <div class="auth-modal" id="labAuthModal" hidden>
        <button type="button" class="auth-modal-backdrop" data-close-auth aria-label="关闭登录窗口"></button>
        <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="labAuthTitle">
          <button type="button" class="auth-dialog-close" data-close-auth aria-label="关闭">×</button>
          <div class="auth-dialog-heading">
            <span class="auth-dialog-logo">楷</span>
            <div>
              <h3 id="labAuthTitle">登录楷模实验室</h3>
              <p>登录后可创建预约，并仅管理本人预约。</p>
            </div>
          </div>
          <form id="labAuthForm">
            <label class="auth-field">
              <span>邮箱</span>
              <input type="email" id="labAuthEmail" autocomplete="email" required placeholder="请输入邮箱">
            </label>
            <label class="auth-field">
              <span>密码</span>
              <input type="password" id="labAuthPassword" autocomplete="current-password" minlength="6" required placeholder="至少 6 位密码">
            </label>
            <label class="auth-field auth-display-name-field">
              <span>显示姓名（注册时可填）</span>
              <input type="text" id="labAuthDisplayName" maxlength="30" autocomplete="name" placeholder="例如：万家玉">
            </label>
            <p class="auth-message" id="labAuthMessage"></p>
            <div class="auth-dialog-actions">
              <button type="submit" class="primary-button" id="labAuthLoginButton">登录</button>
              <button type="button" class="auth-register-button" id="labAuthRegisterButton">注册账户</button>
            </div>
          </form>
          <p class="auth-dialog-note">管理员由服务器环境变量 LAB_ADMIN_EMAILS 指定。</p>
        </section>
      </div>
    `
  );

  document.querySelector("#labAuthAccountButton")?.addEventListener("click", () => {
    if (__labAuthState.user) {
      return;
    }
    window.__labOpenAuthDialog();
  });

  document.querySelector("#labAuthLogoutButton")?.addEventListener("click", async () => {
    const session = __labAuthState.session;
    try {
      if (session?.access_token) {
        const config = await __labLoadAuthConfig();
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

    __labSaveAuthSession(null);
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
    __labRenderAuthUi();
    __labDispatchAuthChanged();
  });

  document.querySelectorAll("[data-close-auth]").forEach((button) => {
    button.addEventListener("click", () => window.__labCloseAuthDialog());
  });

  document.querySelector("#labAuthForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await __labHandleEmailPasswordLogin();
  });

  document.querySelector("#labAuthRegisterButton")?.addEventListener("click", async () => {
    await __labHandleRegistration();
  });
}

function __labSetAuthMessage(message, type = "") {
  const element = document.querySelector("#labAuthMessage");
  if (!element) {
    return;
  }
  element.textContent = message || "";
  element.className = `auth-message${type ? ` ${type}` : ""}`;
}

function __labSetAuthBusy(isBusy) {
  ["#labAuthLoginButton", "#labAuthRegisterButton"].forEach((selector) => {
    const button = document.querySelector(selector);
    if (button) {
      button.disabled = isBusy;
    }
  });
}

async function __labCompleteLogin(payload) {
  const session = __labNormalizeAuthSession(payload);
  if (!session) {
    throw new Error("未收到有效登录会话，请确认邮箱后再登录。"]);
  }

  __labSaveAuthSession(session);
  await __labFetchCurrentUser();
  __labRenderAuthUi();
  __labDispatchAuthChanged();
  window.__labCloseAuthDialog();
}

async function __labHandleEmailPasswordLogin() {
  const email = document.querySelector("#labAuthEmail")?.value.trim() || "";
  const password = document.querySelector("#labAuthPassword")?.value || "";

  if (!email || password.length < 6) {
    __labSetAuthMessage("请输入有效邮箱和至少 6 位密码。", "error");
    return;
  }

  __labSetAuthBusy(true);
  __labSetAuthMessage("正在登录……");
  try {
    const payload = await __labSupabaseAuthRequest(
      "/auth/v1/token?grant_type=password",
      { email, password }
    );
    await __labCompleteLogin(payload);
  } catch (error) {
    __labSetAuthMessage(error.message || "登录失败。", "error");
  } finally {
    __labSetAuthBusy(false);
  }
}

async function __labHandleRegistration() {
  const email = document.querySelector("#labAuthEmail")?.value.trim() || "";
  const password = document.querySelector("#labAuthPassword")?.value || "";
  const displayName =
    document.querySelector("#labAuthDisplayName")?.value.trim() || "";

  if (!email || password.length < 6) {
    __labSetAuthMessage("请输入有效邮箱和至少 6 位密码。", "error");
    return;
  }

  __labSetAuthBusy(true);
  __labSetAuthMessage("正在创建账户……");
  try {
    const payload = await __labSupabaseAuthRequest("/auth/v1/signup", {
      email,
      password,
      data: { display_name: displayName }
    });

    if (payload?.access_token) {
      await __labCompleteLogin(payload);
      return;
    }

    __labSetAuthMessage(
      "账户已创建。请前往邮箱完成确认，然后返回登录。",
      "success"
    );
  } catch (error) {
    __labSetAuthMessage(error.message || "注册失败。", "error");
  } finally {
    __labSetAuthBusy(false);
  }
}

function __labRenderAuthUi() {
  const nameElement = document.querySelector("#labAuthAccountName");
  const roleElement = document.querySelector("#labAuthAccountRole");
  const avatarElement = document.querySelector("#labAuthAvatar");
  const logoutButton = document.querySelector("#labAuthLogoutButton");

  if (!nameElement || !roleElement || !avatarElement || !logoutButton) {
    return;
  }

  if (!__labAuthState.user) {
    nameElement.textContent = "登录 / 注册";
    roleElement.textContent = "预约操作需登录";
    avatarElement.textContent = "登";
    logoutButton.hidden = true;
    return;
  }

  const displayName =
    __labAuthState.user.displayName || __labAuthState.user.email || "实验室成员";
  nameElement.textContent = displayName;
  roleElement.textContent = __labAuthState.isAdmin ? "管理员" : "普通用户";
  avatarElement.textContent = displayName.slice(0, 1).toLocaleUpperCase("zh-CN");
  logoutButton.hidden = false;
}

window.__labOpenAuthDialog = function openLabAuthDialog() {
  const modal = document.querySelector("#labAuthModal");
  if (!modal) {
    return;
  }
  modal.hidden = false;
  document.body.classList.add("auth-modal-open");
  __labSetAuthMessage("");
  window.setTimeout(() => document.querySelector("#labAuthEmail")?.focus(), 0);
};

window.__labCloseAuthDialog = function closeLabAuthDialog() {
  const modal = document.querySelector("#labAuthModal");
  if (!modal) {
    return;
  }
  modal.hidden = true;
  document.body.classList.remove("auth-modal-open");
};

window.__labGetAuthState = function getLabAuthState() {
  return {
    ready: __labAuthState.ready,
    user: __labAuthState.user,
    isAdmin: __labAuthState.isAdmin
  };
};

window.__labGetAuthHeaders = async function getLabAuthHeaders() {
  await window.__labAuthReady;
  const session = await __labEnsureFreshAuthSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
};

async function __labInitializeAuth() {
  __labCreateAuthUi();
  __labSaveAuthSession(__labReadStoredAuthSession());

  try {
    if (__labAuthState.session) {
      await __labFetchCurrentUser();
    } else {
      await __labLoadAuthConfig();
    }
  } catch (error) {
    console.error("初始化登录状态失败：", error);
    __labSaveAuthSession(null);
    __labAuthState.user = null;
    __labAuthState.isAdmin = false;
  }

  __labAuthState.ready = true;
  __labRenderAuthUi();
  __labDispatchAuthChanged();
}

window.__labAuthReady = __labInitializeAuth();
