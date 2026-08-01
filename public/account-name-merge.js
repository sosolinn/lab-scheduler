(() => {
  function setText(element, value) {
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  function setMessage(message, type = "") {
    const element = document.querySelector("#settingsUsersMessage");
    if (!element) return;
    setText(element, message);
    element.className = `settings-message${type ? ` ${type}` : ""}`;
  }

  function mergeLoginUi() {
    const loginInput = document.querySelector("#labAuthUsername");
    if (!loginInput) return;

    const loginLabel = loginInput.closest(".auth-field")?.querySelector("span");
    setText(loginLabel, "账户名称");
    if (loginInput.placeholder !== "请输入姓名") {
      loginInput.placeholder = "请输入姓名";
    }

    const headingNote = document.querySelector(".auth-dialog-heading p");
    setText(headingNote, "使用管理员创建的姓名和密码登录。");
  }

  function mergeAccountNameUi() {
    mergeLoginUi();

    const accountNameValue = document.querySelector("#settingsAccountUsername");
    const accountNameRow = accountNameValue?.closest(".settings-detail-row");
    const accountNameLabel = accountNameRow?.querySelector("dt");
    setText(accountNameLabel, "账户名称");

    const profileForm = document.querySelector("#settingsProfileForm");
    const profileCard = profileForm?.closest(".settings-form-card");
    if (profileCard && !profileCard.hidden) {
      profileCard.hidden = true;
    }

    const usernameInput = document.querySelector("#settingsNewUsername");
    const displayNameInput = document.querySelector(
      "#settingsNewUserDisplayName"
    );
    const createUserForm = document.querySelector(
      "#settingsCreateUserForm"
    );

    if (usernameInput) {
      const usernameLabel = usernameInput
        .closest(".form-group")
        ?.querySelector("label");
      setText(usernameLabel, "成员姓名（同时作为登录名）");
      if (usernameInput.placeholder !== "例如：小明") {
        usernameInput.placeholder = "例如：小明";
      }
      usernameInput.setAttribute("autocomplete", "off");
    }

    if (displayNameInput) {
      const displayNameGroup = displayNameInput.closest(".form-group");
      if (displayNameGroup && !displayNameGroup.hidden) {
        displayNameGroup.hidden = true;
      }
      displayNameInput.tabIndex = -1;
      displayNameInput.setAttribute("aria-hidden", "true");
    }

    if (createUserForm && !createUserForm.dataset.accountNameMerged) {
      createUserForm.dataset.accountNameMerged = "true";
      createUserForm.addEventListener(
        "submit",
        (event) => {
          const accountName = usernameInput?.value.trim() || "";
          const password =
            document.querySelector("#settingsTemporaryPassword")?.value || "";

          if (displayNameInput) {
            displayNameInput.value = accountName;
          }

          if (!accountName || password.length < 8) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setMessage(
              "请填写成员姓名和至少 8 位临时密码。",
              "error"
            );
          }
        },
        true
      );
    }
  }

  function normalizeRenderedUserRows() {
    document.querySelectorAll(".settings-user-row").forEach((row) => {
      const usernameLine = Array.from(
        row.querySelectorAll(".settings-user-main > p")
      ).find((item) => item.textContent.trim().startsWith("用户名："));

      if (!usernameLine) return;

      const accountName = usernameLine.textContent
        .replace(/^用户名：\s*/, "")
        .trim();
      const title = row.querySelector(".settings-user-title strong");
      setText(title, accountName);
      usernameLine.remove();
    });
  }

  function initialize() {
    mergeAccountNameUi();
    normalizeRenderedUserRows();

    const observer = new MutationObserver(() => {
      mergeAccountNameUi();
      normalizeRenderedUserRows();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
