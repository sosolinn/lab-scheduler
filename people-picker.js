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
    inputPlaceholder,
    storageKey,
    deletedStorageKey,
    migrationKey,
    optionsId,
    inputId,
    buttonId,
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

  const migrationCompleted = localStorage.getItem(migrationKey) === "1";
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

  if (migrationCompleted) {
    deletedPeople.clear();
  }

  let availablePeople = uniqueNames([
    ...(Array.isArray(storedPeople) ? storedPeople : []),
    ...(migrationCompleted ? [] : recordPeople)
  ]).filter((name) => !deletedPeople.has(comparisonKey(name)));
  const selectedPeople = new Set();
  let isOpen = false;
  let isBusy = false;

  hiddenInput.type = "hidden";
  hiddenInput.removeAttribute("required");
  hiddenInput.value = "";

  if (label) {
    label.setAttribute("for", inputId);
    label.textContent = `${labelText}（可多选）`;
  }

  const listId = `${optionsId}List`;
  const popoverId = `${optionsId}Popover`;
  const toggleId = `${buttonId}Toggle`;
  const picker = document.createElement("div");
  picker.className = `lab-multi-select ${type}-people-picker`;
  picker.innerHTML = `
    <div
      id="${optionsId}"
      class="lab-multi-select-control"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-controls="${listId}"
    >
      <div class="lab-selected-tags" aria-live="polite"></div>
      <input
        type="text"
        id="${inputId}"
        class="lab-multi-search"
        maxlength="30"
        autocomplete="off"
        aria-autocomplete="list"
        aria-controls="${listId}"
        placeholder="${escapeHtml(inputPlaceholder || `搜索或新建${labelText}`)}"
      >
      <button
        type="button"
        id="${toggleId}"
        class="lab-multi-toggle"
        aria-label="展开${labelText}选项"
        tabindex="-1"
      >⌄</button>
    </div>
    <div id="${popoverId}" class="lab-multi-popover" hidden>
      <div id="${listId}" class="lab-multi-options" role="listbox" aria-multiselectable="true"></div>
      <button type="button" class="lab-create-option" hidden></button>
      <p class="lab-options-empty" hidden>${escapeHtml(emptyText || `暂无${labelText}选项`)}</p>
    </div>
    <p class="duty-people-help ${type}-people-help">点击后可搜索和多选；输入新姓名并按加号可添加新成员。标签“×”仅取消本次选择，下拉列表右侧删除键会从名单中移除人员。</p>
  `;
  hiddenInput.insertAdjacentElement("afterend", picker);

  const control = picker.querySelector(".lab-multi-select-control");
  const tagsElement = picker.querySelector(".lab-selected-tags");
  const searchInput = picker.querySelector(".lab-multi-search");
  const toggleButton = picker.querySelector(".lab-multi-toggle");
  const popover = picker.querySelector(".lab-multi-popover");
  const optionsElement = picker.querySelector(".lab-multi-options");
  const createButton = picker.querySelector(".lab-create-option");
  const emptyElement = picker.querySelector(".lab-options-empty");

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

  function setBusy(value) {
    isBusy = value;
    picker.classList.toggle("is-busy", value);
    searchInput.disabled = value;
    toggleButton.disabled = value;
    createButton.disabled = value;
    picker.querySelectorAll("button").forEach((button) => {
      if (button !== createButton && button !== toggleButton) {
        button.disabled = value;
      }
    });
  }

  function openPopover() {
    if (isBusy) {
      return;
    }
    isOpen = true;
    popover.hidden = false;
    control.classList.add("is-open");
    control.setAttribute("aria-expanded", "true");
    renderOptions();
  }

  function closePopover() {
    isOpen = false;
    popover.hidden = true;
    control.classList.remove("is-open");
    control.setAttribute("aria-expanded", "false");
  }

  function renderTags() {
    tagsElement.innerHTML = Array.from(selectedPeople)
      .map((name) => {
        const safeName = escapeHtml(name);
        return `
          <span class="lab-person-tag">
            <span class="lab-person-tag-label">${safeName}</span>
            <button
              type="button"
              class="lab-person-tag-remove"
              data-unselect-person="${safeName}"
              aria-label="取消选择${safeName}"
              title="取消选择"
            >×</button>
          </span>
        `;
      })
      .join("");

    searchInput.placeholder = selectedPeople.size
      ? "继续搜索或新建"
      : inputPlaceholder || `搜索或新建${labelText}`;
  }

  function renderOptions() {
    const query = normalizeName(searchInput.value);
    const queryKey = comparisonKey(query);
    const filteredPeople = availablePeople.filter((name) =>
      comparisonKey(name).includes(queryKey)
    );

    optionsElement.innerHTML = filteredPeople
      .map((name) => {
        const safeName = escapeHtml(name);
        const selected = selectedPeople.has(name);
        return `
          <div class="lab-person-option-row${selected ? " selected" : ""}">
            <button
              type="button"
              class="lab-person-option-main"
              data-select-person="${safeName}"
              role="option"
              aria-selected="${selected}"
            >
              <span class="lab-person-option-check">${selected ? "✓" : ""}</span>
              <span class="lab-person-option-name">${safeName}</span>
            </button>
            <button
              type="button"
              class="lab-person-option-delete"
              data-delete-person="${safeName}"
              aria-label="从名单删除${safeName}"
              title="从共享名单删除"
            >×</button>
          </div>
        `;
      })
      .join("");

    const exactName = query ? findAvailableName(query) : "";
    createButton.hidden = !query || Boolean(exactName);
    createButton.textContent = query ? `＋ 创建并选择“${query}”` : "";
    createButton.dataset.createPerson = query;

    emptyElement.hidden = filteredPeople.length > 0 || !createButton.hidden;
    if (!query && availablePeople.length === 0) {
      emptyElement.textContent = emptyText || `暂无${labelText}选项，请输入姓名创建。`;
    } else if (query && filteredPeople.length === 0 && createButton.hidden) {
      emptyElement.textContent = "没有匹配人员";
    }
  }

  function renderPeople() {
    renderTags();
    renderOptions();
    syncSelectedPeople();
  }

  function togglePerson(rawName) {
    const storedName = findAvailableName(rawName) || normalizeName(rawName);
    if (!storedName) {
      return;
    }

    if (selectedPeople.has(storedName)) {
      selectedPeople.delete(storedName);
    } else {
      selectedPeople.add(storedName);
    }
    renderPeople();
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
    deletedPeople.clear();
    saveLocalPeople();
  }

  async function refreshPeopleFromDatabase({ migrate = false } = {}) {
    if (migrate) {
      await migrateLocalPeopleOnce();
    }

    const databasePeople = await fetchDatabasePeople();
    const selectedKeys = new Set(Array.from(selectedPeople).map(comparisonKey));
    availablePeople = databasePeople;
    selectedPeople.clear();
    availablePeople.forEach((name) => {
      if (selectedKeys.has(comparisonKey(name))) {
        selectedPeople.add(name);
      }
    });
    saveLocalPeople();
    renderPeople();
  }

  async function createAndSelectPerson(rawName) {
    const newName = normalizeName(rawName);
    if (!newName) {
      return;
    }

    const existingName = findAvailableName(newName);
    if (existingName) {
      selectedPeople.add(existingName);
      searchInput.value = "";
      renderPeople();
      return;
    }

    setBusy(true);
    try {
      await saveDatabasePerson(newName);
      deletedPeople.delete(comparisonKey(newName));
      availablePeople = uniqueNames([...availablePeople, newName]);
      selectedPeople.add(findAvailableName(newName) || newName);
      searchInput.value = "";
      saveLocalPeople();
      renderPeople();
      openPopover();
      showFormMessage(messageElement, `已创建并选择“${newName}”。`, "success");
    } catch (error) {
      console.error(`添加${labelText}失败：`, error);
      showFormMessage(messageElement, error.message || `${labelText}保存失败。`, "error");
    } finally {
      setBusy(false);
      searchInput.focus();
    }
  }

  async function removePersonFromList(rawName) {
    const name = findAvailableName(rawName) || normalizeName(rawName);
    if (!name) {
      return;
    }

    if (!window.confirm(`确定从共享${labelText}名单中删除“${name}”吗？历史记录不会受到影响。`)) {
      return;
    }

    setBusy(true);
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
      showFormMessage(messageElement, `已从共享名单删除“${name}”。`, "success");
    } catch (error) {
      console.error(`删除${labelText}失败：`, error);
      showFormMessage(messageElement, error.message || `${labelText}删除失败。`, "error");
    } finally {
      setBusy(false);
      searchInput.focus();
    }
  }

  control.addEventListener("click", (event) => {
    if (event.target.closest(".lab-person-tag-remove")) {
      return;
    }
    openPopover();
    searchInput.focus();
  });

  toggleButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
      searchInput.focus();
    }
  });

  tagsElement.addEventListener("click", (event) => {
    const removeTag = event.target.closest("[data-unselect-person]");
    if (!removeTag) {
      return;
    }
    event.stopPropagation();
    const name = removeTag.dataset.unselectPerson;
    const storedName = findAvailableName(name) || name;
    selectedPeople.delete(storedName);
    renderPeople();
    searchInput.focus();
  });

  optionsElement.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-person]");
    if (deleteButton) {
      event.stopPropagation();
      removePersonFromList(deleteButton.dataset.deletePerson);
      return;
    }

    const optionButton = event.target.closest("[data-select-person]");
    if (!optionButton) {
      return;
    }
    togglePerson(optionButton.dataset.selectPerson);
    searchInput.value = "";
    renderPeople();
    searchInput.focus();
  });

  createButton.addEventListener("click", () => {
    createAndSelectPerson(createButton.dataset.createPerson || searchInput.value);
  });

  searchInput.addEventListener("focus", openPopover);
  searchInput.addEventListener("input", () => {
    openPopover();
    renderOptions();
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const query = normalizeName(searchInput.value);
      if (!query) {
        return;
      }
      const existingName = findAvailableName(query);
      if (existingName) {
        selectedPeople.add(existingName);
        searchInput.value = "";
        renderPeople();
      } else {
        createAndSelectPerson(query);
      }
    } else if (event.key === "Backspace" && !searchInput.value && selectedPeople.size) {
      const lastName = Array.from(selectedPeople).at(-1);
      selectedPeople.delete(lastName);
      renderPeople();
    } else if (event.key === "Escape") {
      closePopover();
      searchInput.blur();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      openPopover();
      picker.querySelector(".lab-person-option-main")?.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!picker.contains(event.target)) {
      closePopover();
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
        openPopover();
        searchInput.focus();
      }
    },
    true
  );

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      selectedPeople.clear();
      searchInput.value = "";
      closePopover();
      renderPeople();
    }, 0);
  });

  if (refreshedEvent) {
    window.addEventListener(refreshedEvent, () => {
      refreshPeopleFromDatabase().catch((error) => {
        console.error(`刷新${labelText}名单失败：`, error);
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
