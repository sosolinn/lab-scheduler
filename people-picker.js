const __LAB_PEOPLE_API_ENDPOINT = "/api/people";

window.__createLabPeoplePicker = function createLabPeoplePicker(config) {
  const {
    type,
    inputSelector,
    labelSelector,
    form,
    messageElement,
    labelText,
    emptyText,
    addButtonText,
    inputPlaceholder,
    storageKey,
    deletedStorageKey,
    migrationKey,
    optionsId,
    inputId,
    buttonId,
    selectDataAttribute,
    removeDataAttribute,
    getRecords,
    extractNames,
    refreshedEvent
  } = config;

  const hiddenInput = document.querySelector(inputSelector);
  const label = document.querySelector(labelSelector);

  if (!hiddenInput || !form) {
    return;
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 30);
  }

  function comparisonKey(value) {
    return normalizeName(value).toLocaleLowerCase("zh-CN");
  }

  function uniqueNames(values) {
    const seen = new Set();

    return values
      .map(normalizeName)
      .filter((name) => {
        const key = comparisonKey(name);
        if (!name || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  const storedPeople = loadData(storageKey);
  const storedDeletedPeople = loadData(deletedStorageKey);
  const deletedPeople = new Set(
    (Array.isArray(storedDeletedPeople) ? storedDeletedPeople : [])
      .map(comparisonKey)
      .filter(Boolean)
  );
  const recordPeople = Array.isArray(getRecords?.())
    ? getRecords().flatMap(extractNames)
    : [];

  let availablePeople = uniqueNames([
    ...(Array.isArray(storedPeople) ? storedPeople : []),
    ...recordPeople
  ]).filter((name) => !deletedPeople.has(comparisonKey(name)));
  const selectedPeople = new Set();

  hiddenInput.type = "hidden";
  hiddenInput.removeAttribute("required");
  hiddenInput.value = "";

  if (label) {
    label.setAttribute("for", inputId);
    label.textContent = `${labelText}（可多选）`;
  }

  const picker = document.createElement("div");
  picker.className = `duty-people-picker ${type}-people-picker`;
  picker.innerHTML = `
    <div
      id="${optionsId}"
      class="duty-people-options ${type}-people-options"
      role="group"
      aria-label="选择${labelText}"
    ></div>
    <div class="duty-person-add-row ${type}-person-add-row">
      <input
        type="text"
        id="${inputId}"
        maxlength="30"
        autocomplete="off"
        placeholder="${inputPlaceholder}"
      >
      <button type="button" id="${buttonId}" class="duty-person-add-button ${type}-person-add-button">
        ${addButtonText}
      </button>
    </div>
    <p class="duty-people-help ${type}-people-help">可同时选择多人；点击姓名进行选择，点击右上角“×”可删除错误选项。人员名单会同步到数据库。</p>
  `;
  hiddenInput.insertAdjacentElement("afterend", picker);

  const optionsElement = document.querySelector(`#${optionsId}`);
  const newNameInput = document.querySelector(`#${inputId}`);
  const addButton = document.querySelector(`#${buttonId}`);

  function saveLocalPeople() {
    saveData(storageKey, availablePeople);
    saveData(deletedStorageKey, Array.from(deletedPeople));
  }

  function syncSelectedPeople() {
    hiddenInput.value = Array.from(selectedPeople).join("、");
  }

  function findAvailableName(rawName) {
    const key = comparisonKey(rawName);
    return availablePeople.find((name) => comparisonKey(name) === key);
  }

  function renderPeople() {
    if (availablePeople.length === 0) {
      optionsElement.innerHTML = `<p class="duty-people-empty">${emptyText}</p>`;
      syncSelectedPeople();
      return;
    }

    optionsElement.innerHTML = availablePeople
      .map((name) => {
        const isSelected = selectedPeople.has(name);
        const safeName = escapeHtml(name);

        return `
          <div class="duty-person-option${isSelected ? " selected" : ""}">
            <button
              type="button"
              class="duty-person-select"
              data-${selectDataAttribute}="${safeName}"
              aria-pressed="${isSelected}"
            >${safeName}</button>
            <button
              type="button"
              class="duty-person-remove"
              data-${removeDataAttribute}="${safeName}"
              aria-label="删除${labelText}选项：${safeName}"
              title="删除此选项"
            >×</button>
          </div>
        `;
      })
      .join("");

    syncSelectedPeople();
  }

  async function readResponseError(response, fallbackMessage) {
    try {
      const payload = await response.json();
      return payload.error || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  async function fetchDatabasePeople() {
    const response = await fetch(
      `${__LAB_PEOPLE_API_ENDPOINT}?type=${encodeURIComponent(type)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" }
      }
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response, "无法读取人员名单。"));
    }

    const payload = await response.json();
    return uniqueNames(payload.people || []);
  }

  async function saveDatabasePerson(name) {
    const response = await fetch(__LAB_PEOPLE_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ type, name })
    });

    if (!response.ok) {
      throw new Error(await readResponseError(response, "人员保存失败。"));
    }
  }

  async function deleteDatabasePerson(name) {
    const response = await fetch(
      `${__LAB_PEOPLE_API_ENDPOINT}?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`,
      {
        method: "DELETE",
        headers: { Accept: "application/json" }
      }
    );

    if (!response.ok) {
      throw new Error(await readResponseError(response, "人员删除失败。"));
    }
  }

  async function migrateLocalPeopleOnce() {
    if (localStorage.getItem(migrationKey) === "1") {
      return;
    }

    for (const deletedName of deletedPeople) {
      await deleteDatabasePerson(deletedName);
    }

    for (const name of availablePeople) {
      await saveDatabasePerson(name);
    }

    localStorage.setItem(migrationKey, "1");
  }

  async function refreshPeopleFromDatabase({ migrate = false } = {}) {
    if (migrate) {
      await migrateLocalPeopleOnce();
    }

    const databasePeople = await fetchDatabasePeople();
    const selectedKeys = new Set(Array.from(selectedPeople).map(comparisonKey));
    availablePeople = databasePeople.filter(
      (name) => !deletedPeople.has(comparisonKey(name))
    );
    selectedPeople.clear();
    availablePeople.forEach((name) => {
      if (selectedKeys.has(comparisonKey(name))) {
        selectedPeople.add(name);
      }
    });
    saveLocalPeople();
    renderPeople();
  }

  async function syncRecordPeopleToDatabase() {
    const records = getRecords?.();
    if (!Array.isArray(records)) {
      return;
    }

    const names = uniqueNames(records.flatMap(extractNames)).filter(
      (name) => !deletedPeople.has(comparisonKey(name))
    );
    const missingNames = names.filter((name) => !findAvailableName(name));

    if (missingNames.length === 0) {
      await refreshPeopleFromDatabase();
      return;
    }

    for (const name of missingNames) {
      await saveDatabasePerson(name);
    }
    await refreshPeopleFromDatabase();
  }

  async function addPerson() {
    const newName = normalizeName(newNameInput.value);

    if (!newName) {
      showFormMessage(messageElement, `请输入需要添加的${labelText}姓名。`, "error");
      newNameInput.focus();
      return;
    }

    const existingName = findAvailableName(newName);
    if (existingName) {
      selectedPeople.add(existingName);
      newNameInput.value = "";
      renderPeople();
      showFormMessage(messageElement, `“${existingName}”已存在，已为你选中。`, "success");
      return;
    }

    addButton.disabled = true;
    try {
      await saveDatabasePerson(newName);
      deletedPeople.delete(comparisonKey(newName));
      availablePeople.push(newName);
      selectedPeople.add(newName);
      saveLocalPeople();
      newNameInput.value = "";
      renderPeople();
      showFormMessage(messageElement, `已添加并同步“${newName}”。`, "success");
    } catch (error) {
      console.error(`添加${labelText}失败：`, error);
      showFormMessage(messageElement, error.message || `${labelText}保存失败。`, "error");
    } finally {
      addButton.disabled = false;
    }
  }

  optionsElement.addEventListener("click", async (event) => {
    const removeButton = event.target.closest(`[data-${removeDataAttribute}]`);

    if (removeButton) {
      const name = removeButton.dataset[
        removeDataAttribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      ];

      if (!window.confirm(`确定删除“${name}”这个${labelText}选项吗？`)) {
        return;
      }

      removeButton.disabled = true;
      try {
        await deleteDatabasePerson(name);
        deletedPeople.add(comparisonKey(name));
        availablePeople = availablePeople.filter(
          (person) => comparisonKey(person) !== comparisonKey(name)
        );
        Array.from(selectedPeople).forEach((person) => {
          if (comparisonKey(person) === comparisonKey(name)) {
            selectedPeople.delete(person);
          }
        });
        saveLocalPeople();
        renderPeople();
      } catch (error) {
        console.error(`删除${labelText}失败：`, error);
        showFormMessage(messageElement, error.message || `${labelText}删除失败。`, "error");
        removeButton.disabled = false;
      }
      return;
    }

    const selectButton = event.target.closest(`[data-${selectDataAttribute}]`);
    if (!selectButton) {
      return;
    }

    const name = selectButton.dataset[
      selectDataAttribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    ];
    const storedName = findAvailableName(name) || name;

    if (selectedPeople.has(storedName)) {
      selectedPeople.delete(storedName);
    } else {
      selectedPeople.add(storedName);
    }

    renderPeople();
  });

  addButton.addEventListener("click", addPerson);
  newNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPerson();
    }
  });

  form.addEventListener(
    "submit",
    (event) => {
      syncSelectedPeople();

      if (selectedPeople.size === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showFormMessage(messageElement, `请至少选择一位${labelText}。`, "error");
        newNameInput.focus();
      }
    },
    true
  );

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedPeople.clear();
      newNameInput.value = "";
      renderPeople();
    }, 0);
  });

  if (refreshedEvent) {
    window.addEventListener(refreshedEvent, () => {
      syncRecordPeopleToDatabase().catch((error) => {
        console.error(`同步${labelText}名单失败：`, error);
      });
    });
  }

  window.addEventListener("focus", () => {
    refreshPeopleFromDatabase().catch((error) => {
      console.error(`刷新${labelText}名单失败：`, error);
    });
  });

  saveLocalPeople();
  renderPeople();
  refreshPeopleFromDatabase({ migrate: true }).catch((error) => {
    console.error(`初始化${labelText}名单失败：`, error);
    showFormMessage(
      messageElement,
      error.message || `${labelText}名单未连接数据库，当前显示浏览器缓存。`,
      "error"
    );
  });
};
