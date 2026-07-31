window.addEventListener("lab:people-picker-set", (event) => {
  const type = event.detail?.type;
  const names = Array.isArray(event.detail?.names) ? event.detail.names : [];
  if (!type) {
    return;
  }

  const picker = document.querySelector(`.${type}-people-picker`);
  if (!picker) {
    return;
  }

  picker.querySelectorAll("[data-unselect-person]").forEach((button) => {
    button.click();
  });

  names.forEach((name) => {
    const option = Array.from(
      picker.querySelectorAll("[data-select-person]")
    ).find((button) => button.dataset.selectPerson === name);
    option?.click();
  });
});
