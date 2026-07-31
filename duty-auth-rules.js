const __labDutyAuthSubmitButton = dutyForm.querySelector('button[type="submit"]');

if (__labDutyAuthSubmitButton) {
  const note = document.createElement("p");
  note.className = "booking-auth-required-note";
  note.textContent = "登录后方可提交或覆盖当日值日记录；所有人仍可查看历史值日情况。";
  __labDutyAuthSubmitButton.insertAdjacentElement("afterend", note);
}

function __labDutyCurrentAuthUser() {
  return window.__labGetAuthState?.().user || null;
}

function __labUpdateDutyAuthUi() {
  if (!__labDutyAuthSubmitButton) {
    return;
  }

  __labDutyAuthSubmitButton.textContent = __labDutyCurrentAuthUser()
    ? "提交值日记录"
    : "登录后提交值日";
}

dutyForm.addEventListener(
  "submit",
  (event) => {
    if (__labDutyCurrentAuthUser()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    showFormMessage(dutyMessage, "请先登录后再提交值日记录。", "error");
    window.__labOpenAuthDialog?.();
  },
  true
);

window.addEventListener("lab:auth-changed", __labUpdateDutyAuthUi);
window.addEventListener("lab:duties-refreshed", __labUpdateDutyAuthUi);

__labUpdateDutyAuthUi();
