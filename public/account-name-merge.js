(() => {
  function mergeAccountNameUi() {
    const accountNameValue = document.querySelector("#settingsAccountUsername");
    const accountNameRow = accountNameValue?.closest(".settings-detail-row");
    const accountNameLabel = accountNameRow?.querySelector("dt");
    if (accountNameLabel) {
      accountNameLabel.textContent = "账户名称";
    }

    const profileForm = document.querySelector("#settingsProfileForm");
    const profileCard = profileForm?.closest(".settings-form-card");
    if (profileCard) {
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
      if (usernameLabel) {
        usernameLabel.textContent = "成员姓名（同时作为登录名）";
      }
      usernameInput.placeholder = "例如：小明";
      usernameInput.setAttribute("autocomplete", "off");
    }

    if (displayNameInput) {
      const displayNameGroup = displayNameInput.closest(".form-group");
      if (displayNameGroup) {
        displayNameGroup.hidden = true;
      }
      displayNameInput.tabIndex = -1;
      displayNameInput.setAttribute("aria-hidden", "true");
    }

    if (createUserForm && !createUserForm.dataset.accountNameMerged) {
      createUserForm.dataset.accountNameMerged = "true";
      createUserForm.addEventListener(
        "submit",
        () => {
          if (usernameInput && displayNameInput) {
            displayNameInput.value = usernameInput.value.trim();
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
      if (title && accountName) {
        title.textContent = accountName;
      }
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
