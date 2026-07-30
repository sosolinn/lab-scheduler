const DUTY_PEOPLE_STORAGE_KEY = "labSchedulerDutyPeople";
const DUTY_PEOPLE_DELETED_STORAGE_KEY = "labSchedulerDeletedDutyPeople";

const __dutyNameInput = document.querySelector("#dutyName");
const __dutyNameLabel = document.querySelector('label[for="dutyName"]');

function __normalizeDutyPersonName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function __dutyPersonComparisonKey(value) {
  return __normalizeDutyPersonName(value).toLocaleLowerCase("zh-CN");
}

function __extractDutyPersonNames(duty) {
  if (Array.isArray(duty?.names)) {
    return duty.names.map(__normalizeDutyPersonName).filter(Boolean);
  }

  return String(duty?.name || "")
    .split(/[、,，;；/]+/)
    .map(__normalizeDutyPersonName)
    .filter((name) => name && name !== "未填写");
}

function __uniqueDutyPersonNames(names) {
  const seen = new Set();

  return names.filter((name) => {
    const normalizedName = __normalizeDutyPersonName(name);
    const comparisonKey = __dutyPersonComparisonKey(normalizedName);

    if (!normalizedName || seen.has(comparisonKey)) {
      return false;
    }

    seen.add(comparisonKey);
    return true;
  });
}

if (__dutyNameInput) {
  const storedDutyPeople = loadData(DUTY_PEOPLE_STORAGE_KEY);
  const storedDeletedDutyPeople = loadData(DUTY_PEOPLE_DELETED_STORAGE_KEY);
  const historicalDutyPeople = Array.isArray(duties)
    ? duties.flatMap(__extractDutyPersonNames)
    : [];
  const __deletedDutyPeople = new Set(
    (Array.isArray(storedDeletedDutyPeople) ? storedDeletedDutyPeople : [])
      .map(__dutyPersonComparisonKey)
      .filter(Boolean)
  );

  let __availableDutyPeople = __uniqueDutyPersonNames([
    ...(Array.isArray(storedDutyPeople) ? storedDutyPeople : []),
    ...historicalDutyPeople.filter(
      (name) => !__deletedDutyPeople.has(__dutyPersonComparisonKey(name))
    )
  ]).filter((name) => !__deletedDutyPeople.has(__dutyPersonComparisonKey(name)));
  const __selectedDutyPeople = new Set();

  __dutyNameInput.type = "hidden";
  __dutyNameInput.removeAttribute("required");
  __dutyNameInput.value = "";

  if (__dutyNameLabel) {
    __dutyNameLabel.setAttribute("for", "dutyPersonNewName");
    __dutyNameLabel.textContent = "值日人（可多选）";
  }

  const __dutyPeoplePicker = document.createElement("div");
  __dutyPeoplePicker.className = "duty-people-picker";
  __dutyPeoplePicker.innerHTML = `
    <div
      id="dutyPeopleOptions"
      class="duty-people-options"
      role="group"
      aria-label="选择值日人"
    ></div>
    <div class="duty-person-add-row">
      <input
        type="text"
        id="dutyPersonNewName"
        maxlength="30"
        autocomplete="off"
        placeholder="没有合适人选时，请输入姓名"
      >
      <button type="button" id="addDutyPersonButton" class="duty-person-add-button">
        添加值日人
      </button>
    </div>
    <p class="duty-people-help">可同时选择多人；点击姓名进行选择，点击右上角“×”可删除错误选项。</p>
  `;
  __dutyNameInput.insertAdjacentElement("afterend", __dutyPeoplePicker);

  const __dutyPeopleOptions = document.querySelector("#dutyPeopleOptions");
  const __dutyPersonNewName = document.querySelector("#dutyPersonNewName");
  const __addDutyPersonButton = document.querySelector("#addDutyPersonButton");

  function __saveDutyPeople() {
    saveData(DUTY_PEOPLE_STORAGE_KEY, __availableDutyPeople);
    saveData(DUTY_PEOPLE_DELETED_STORAGE_KEY, Array.from(__deletedDutyPeople));
  }

  function __syncSelectedDutyPeople() {
    __dutyNameInput.value = Array.from(__selectedDutyPeople).join("、");
  }

  function __renderDutyPeople() {
    if (__availableDutyPeople.length === 0) {
      __dutyPeopleOptions.innerHTML = `
        <p class="duty-people-empty">暂无值日人选项，请在下方输入姓名并添加。</p>
      `;
      __syncSelectedDutyPeople();
      return;
    }

    __dutyPeopleOptions.innerHTML = __availableDutyPeople
      .map((name) => {
        const isSelected = __selectedDutyPeople.has(name);
        const safeName = escapeHtml(name);

        return `
          <div class="duty-person-option${isSelected ? " selected" : ""}">
            <button
              type="button"
              class="duty-person-select"
              data-duty-person-select="${safeName}"
              aria-pressed="${isSelected}"
            >${safeName}</button>
            <button
              type="button"
              class="duty-person-remove"
              data-duty-person-remove="${safeName}"
              aria-label="删除值日人选项：${safeName}"
              title="删除此选项"
            >×</button>
          </div>
        `;
      })
      .join("");

    __syncSelectedDutyPeople();
  }

  function __findDutyPersonName(rawName) {
    const comparisonKey = __dutyPersonComparisonKey(rawName);
    return __availableDutyPeople.find(
      (name) => __dutyPersonComparisonKey(name) === comparisonKey
    );
  }

  function __addDutyPerson() {
    const newName = __normalizeDutyPersonName(__dutyPersonNewName.value);

    if (!newName) {
      showFormMessage(dutyMessage, "请输入需要添加的值日人姓名。", "error");
      __dutyPersonNewName.focus();
      return;
    }

    const existingName = __findDutyPersonName(newName);

    if (existingName) {
      __selectedDutyPeople.add(existingName);
      __dutyPersonNewName.value = "";
      __renderDutyPeople();
      showFormMessage(dutyMessage, `“${existingName}”已存在，已为你选中。`, "success");
      return;
    }

    __deletedDutyPeople.delete(__dutyPersonComparisonKey(newName));
    __availableDutyPeople.push(newName);
    __selectedDutyPeople.add(newName);
    __saveDutyPeople();
    __dutyPersonNewName.value = "";
    __renderDutyPeople();
    showFormMessage(dutyMessage, `已添加并选中“${newName}”。`, "success");
  }

  __dutyPeopleOptions.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-duty-person-remove]");

    if (removeButton) {
      const name = removeButton.dataset.dutyPersonRemove;

      if (!window.confirm(`确定删除“${name}”这个值日人选项吗？`)) {
        return;
      }

      __deletedDutyPeople.add(__dutyPersonComparisonKey(name));
      __availableDutyPeople = __availableDutyPeople.filter((person) => person !== name);
      __selectedDutyPeople.delete(name);
      __saveDutyPeople();
      __renderDutyPeople();
      return;
    }

    const selectButton = event.target.closest("[data-duty-person-select]");

    if (!selectButton) {
      return;
    }

    const name = selectButton.dataset.dutyPersonSelect;

    if (__selectedDutyPeople.has(name)) {
      __selectedDutyPeople.delete(name);
    } else {
      __selectedDutyPeople.add(name);
    }

    __renderDutyPeople();
  });

  __addDutyPersonButton.addEventListener("click", __addDutyPerson);
  __dutyPersonNewName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      __addDutyPerson();
    }
  });

  dutyForm.addEventListener(
    "submit",
    (event) => {
      __syncSelectedDutyPeople();

      if (__selectedDutyPeople.size === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showFormMessage(dutyMessage, "请至少选择一位值日人。", "error");
        __dutyPersonNewName.focus();
      }
    },
    true
  );

  dutyForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      __selectedDutyPeople.clear();
      __dutyPersonNewName.value = "";
      __renderDutyPeople();
    }, 0);
  });

  __saveDutyPeople();
  __renderDutyPeople();
}
