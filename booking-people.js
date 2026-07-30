const BOOKING_PEOPLE_STORAGE_KEY = "labSchedulerBookingPeople";
const BOOKING_PEOPLE_DELETED_STORAGE_KEY = "labSchedulerDeletedBookingPeople";

const __bookingNameInput = document.querySelector("#bookingName");
const __bookingNameLabel = document.querySelector('label[for="bookingName"]');

function __normalizeBookingPersonName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function __bookingPersonComparisonKey(value) {
  return __normalizeBookingPersonName(value).toLocaleLowerCase("zh-CN");
}

function __extractBookingPersonNames(booking) {
  return String(booking?.name || "")
    .split(/[、,，;；/]+/)
    .map(__normalizeBookingPersonName)
    .filter((name) => name && name !== "未填写");
}

function __uniqueBookingPersonNames(names) {
  const seen = new Set();

  return names.filter((name) => {
    const normalizedName = __normalizeBookingPersonName(name);
    const comparisonKey = __bookingPersonComparisonKey(normalizedName);

    if (!normalizedName || seen.has(comparisonKey)) {
      return false;
    }

    seen.add(comparisonKey);
    return true;
  });
}

if (__bookingNameInput) {
  const storedBookingPeople = loadData(BOOKING_PEOPLE_STORAGE_KEY);
  const storedDeletedBookingPeople = loadData(BOOKING_PEOPLE_DELETED_STORAGE_KEY);
  const __deletedBookingPeople = new Set(
    (Array.isArray(storedDeletedBookingPeople) ? storedDeletedBookingPeople : [])
      .map(__bookingPersonComparisonKey)
      .filter(Boolean)
  );

  let __availableBookingPeople = __uniqueBookingPersonNames([
    ...(Array.isArray(storedBookingPeople) ? storedBookingPeople : []),
    ...(Array.isArray(bookings) ? bookings.flatMap(__extractBookingPersonNames) : [])
  ]).filter(
    (name) => !__deletedBookingPeople.has(__bookingPersonComparisonKey(name))
  );
  const __selectedBookingPeople = new Set();

  __bookingNameInput.type = "hidden";
  __bookingNameInput.removeAttribute("required");
  __bookingNameInput.value = "";

  if (__bookingNameLabel) {
    __bookingNameLabel.setAttribute("for", "bookingPersonNewName");
    __bookingNameLabel.textContent = "预约人（可多选）";
  }

  const __bookingPeoplePicker = document.createElement("div");
  __bookingPeoplePicker.className = "duty-people-picker booking-people-picker";
  __bookingPeoplePicker.innerHTML = `
    <div
      id="bookingPeopleOptions"
      class="duty-people-options booking-people-options"
      role="group"
      aria-label="选择预约人"
    ></div>
    <div class="duty-person-add-row booking-person-add-row">
      <input
        type="text"
        id="bookingPersonNewName"
        maxlength="30"
        autocomplete="off"
        placeholder="没有合适人选时，请输入姓名"
      >
      <button type="button" id="addBookingPersonButton" class="duty-person-add-button booking-person-add-button">
        添加预约人
      </button>
    </div>
    <p class="duty-people-help booking-people-help">可同时选择多人；点击姓名进行选择，点击右上角“×”可删除错误选项。</p>
  `;
  __bookingNameInput.insertAdjacentElement("afterend", __bookingPeoplePicker);

  const __bookingPeopleOptions = document.querySelector("#bookingPeopleOptions");
  const __bookingPersonNewName = document.querySelector("#bookingPersonNewName");
  const __addBookingPersonButton = document.querySelector("#addBookingPersonButton");

  function __saveBookingPeople() {
    saveData(BOOKING_PEOPLE_STORAGE_KEY, __availableBookingPeople);
    saveData(
      BOOKING_PEOPLE_DELETED_STORAGE_KEY,
      Array.from(__deletedBookingPeople)
    );
  }

  function __syncSelectedBookingPeople() {
    __bookingNameInput.value = Array.from(__selectedBookingPeople).join("、");
  }

  function __renderBookingPeople() {
    if (__availableBookingPeople.length === 0) {
      __bookingPeopleOptions.innerHTML = `
        <p class="duty-people-empty">暂无预约人选项，请在下方输入姓名并添加。</p>
      `;
      __syncSelectedBookingPeople();
      return;
    }

    __bookingPeopleOptions.innerHTML = __availableBookingPeople
      .map((name) => {
        const isSelected = __selectedBookingPeople.has(name);
        const safeName = escapeHtml(name);

        return `
          <div class="duty-person-option${isSelected ? " selected" : ""}">
            <button
              type="button"
              class="duty-person-select"
              data-booking-person-select="${safeName}"
              aria-pressed="${isSelected}"
            >${safeName}</button>
            <button
              type="button"
              class="duty-person-remove"
              data-booking-person-remove="${safeName}"
              aria-label="删除预约人选项：${safeName}"
              title="删除此选项"
            >×</button>
          </div>
        `;
      })
      .join("");

    __syncSelectedBookingPeople();
  }

  function __findBookingPersonName(rawName) {
    const comparisonKey = __bookingPersonComparisonKey(rawName);
    return __availableBookingPeople.find(
      (name) => __bookingPersonComparisonKey(name) === comparisonKey
    );
  }

  function __mergeBookingPeopleFromRecords() {
    const recordNames = Array.isArray(bookings)
      ? bookings.flatMap(__extractBookingPersonNames)
      : [];
    let changed = false;

    recordNames.forEach((name) => {
      const comparisonKey = __bookingPersonComparisonKey(name);

      if (
        !comparisonKey ||
        __deletedBookingPeople.has(comparisonKey) ||
        __findBookingPersonName(name)
      ) {
        return;
      }

      __availableBookingPeople.push(__normalizeBookingPersonName(name));
      changed = true;
    });

    if (changed) {
      __saveBookingPeople();
      __renderBookingPeople();
    }
  }

  function __addBookingPerson() {
    const newName = __normalizeBookingPersonName(__bookingPersonNewName.value);

    if (!newName) {
      showFormMessage(bookingMessage, "请输入需要添加的预约人姓名。", "error");
      __bookingPersonNewName.focus();
      return;
    }

    const existingName = __findBookingPersonName(newName);

    if (existingName) {
      __selectedBookingPeople.add(existingName);
      __bookingPersonNewName.value = "";
      __renderBookingPeople();
      showFormMessage(
        bookingMessage,
        `“${existingName}”已存在，已为你选中。`,
        "success"
      );
      return;
    }

    __deletedBookingPeople.delete(__bookingPersonComparisonKey(newName));
    __availableBookingPeople.push(newName);
    __selectedBookingPeople.add(newName);
    __saveBookingPeople();
    __bookingPersonNewName.value = "";
    __renderBookingPeople();
    showFormMessage(bookingMessage, `已添加并选中“${newName}”。`, "success");
  }

  __bookingPeopleOptions.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-booking-person-remove]");

    if (removeButton) {
      const name = removeButton.dataset.bookingPersonRemove;

      if (!window.confirm(`确定删除“${name}”这个预约人选项吗？`)) {
        return;
      }

      __deletedBookingPeople.add(__bookingPersonComparisonKey(name));
      __availableBookingPeople = __availableBookingPeople.filter(
        (person) => person !== name
      );
      __selectedBookingPeople.delete(name);
      __saveBookingPeople();
      __renderBookingPeople();
      return;
    }

    const selectButton = event.target.closest("[data-booking-person-select]");

    if (!selectButton) {
      return;
    }

    const name = selectButton.dataset.bookingPersonSelect;

    if (__selectedBookingPeople.has(name)) {
      __selectedBookingPeople.delete(name);
    } else {
      __selectedBookingPeople.add(name);
    }

    __renderBookingPeople();
  });

  __addBookingPersonButton.addEventListener("click", __addBookingPerson);
  __bookingPersonNewName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      __addBookingPerson();
    }
  });

  bookingForm.addEventListener(
    "submit",
    (event) => {
      __syncSelectedBookingPeople();

      if (__selectedBookingPeople.size === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showFormMessage(bookingMessage, "请至少选择一位预约人。", "error");
        __bookingPersonNewName.focus();
      }
    },
    true
  );

  bookingForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      __selectedBookingPeople.clear();
      __bookingPersonNewName.value = "";
      __renderBookingPeople();
    }, 0);
  });

  const __bookingOriginalRenderAll = renderAll;
  renderAll = function renderAllWithBookingPeople() {
    const result = __bookingOriginalRenderAll();
    __mergeBookingPeopleFromRecords();
    return result;
  };

  __saveBookingPeople();
  __renderBookingPeople();
}