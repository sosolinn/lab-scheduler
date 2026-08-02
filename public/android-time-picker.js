(() => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobileWidth = window.matchMedia("(max-width: 720px)").matches;

  if (!isAndroid || !isMobileWidth) {
    return;
  }

  const ITEM_HEIGHT = 48;
  const TIME_INPUT_IDS = ["startTime", "endTime"];
  let activeInput = null;
  let selectedHour = 0;
  let selectedMinute = 0;
  let scrollFrame = 0;

  const pad = (value) => String(value).padStart(2, "0");

  function parseTime(value) {
    const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      return null;
    }

    return { hour, minute };
  }

  function getSuggestedTime(input) {
    const currentValue = parseTime(input.value);
    if (currentValue) {
      return currentValue;
    }

    if (input.id === "endTime") {
      const startValue = parseTime(document.querySelector("#startTime")?.value);
      if (startValue) {
        const total = (startValue.hour * 60 + startValue.minute + 60) % 1440;
        return {
          hour: Math.floor(total / 60),
          minute: total % 60
        };
      }
    }

    const now = new Date();
    let totalMinutes = now.getHours() * 60 + now.getMinutes();
    totalMinutes = Math.ceil(totalMinutes / 5) * 5;

    if (input.id === "endTime") {
      totalMinutes += 60;
    }

    totalMinutes %= 1440;
    return {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60
    };
  }

  function createOptions(count) {
    return Array.from({ length: count }, (_, index) => (
      `<button type="button" class="android-time-wheel-option" data-value="${index}" role="option">${pad(index)}</button>`
    )).join("");
  }

  function ensurePicker() {
    let picker = document.querySelector("#androidTimePicker");
    if (picker) {
      return picker;
    }

    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="android-time-picker" id="androidTimePicker" hidden>
        <button type="button" class="android-time-picker-backdrop" data-android-time-cancel aria-label="关闭时间选择器"></button>
        <section class="android-time-picker-panel" role="dialog" aria-modal="true" aria-labelledby="androidTimePickerTitle">
          <header class="android-time-picker-toolbar">
            <button type="button" class="android-time-picker-action" data-android-time-cancel>取消</button>
            <h3 id="androidTimePickerTitle">选择时间</h3>
            <button type="button" class="android-time-picker-action" data-android-time-done>完成</button>
          </header>
          <div class="android-time-picker-preview" aria-live="polite">
            <span id="androidTimePickerHour">00</span>
            <span>:</span>
            <span id="androidTimePickerMinute">00</span>
          </div>
          <div class="android-time-picker-wheels">
            <div class="android-time-picker-highlight" aria-hidden="true"></div>
            <div class="android-time-wheel" data-android-time-wheel="hour" role="listbox" aria-label="小时">
              ${createOptions(24)}
            </div>
            <div class="android-time-wheel" data-android-time-wheel="minute" role="listbox" aria-label="分钟">
              ${createOptions(60)}
            </div>
          </div>
          <button type="button" class="android-time-picker-clear" data-android-time-clear>清空时间</button>
        </section>
      </div>`
    );

    picker = document.querySelector("#androidTimePicker");
    picker.querySelectorAll("[data-android-time-cancel]").forEach((button) => {
      button.addEventListener("click", closePicker);
    });

    picker.querySelector("[data-android-time-done]")?.addEventListener("click", applyTime);
    picker.querySelector("[data-android-time-clear]")?.addEventListener("click", clearTime);

    picker.querySelectorAll("[data-android-time-wheel]").forEach((wheel) => {
      wheel.addEventListener("scroll", () => {
        window.cancelAnimationFrame(scrollFrame);
        scrollFrame = window.requestAnimationFrame(() => syncWheelValue(wheel));
      }, { passive: true });

      wheel.addEventListener("click", (event) => {
        const option = event.target.closest(".android-time-wheel-option");
        if (!option) {
          return;
        }
        const index = Number(option.dataset.value);
        wheel.scrollTo({ top: index * ITEM_HEIGHT, behavior: "smooth" });
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !picker.hidden) {
        closePicker();
      }
    });

    return picker;
  }

  function updatePreview() {
    const picker = ensurePicker();
    picker.querySelector("#androidTimePickerHour").textContent = pad(selectedHour);
    picker.querySelector("#androidTimePickerMinute").textContent = pad(selectedMinute);

    picker.querySelectorAll("[data-android-time-wheel]").forEach((wheel) => {
      const type = wheel.dataset.androidTimeWheel;
      const selectedValue = type === "hour" ? selectedHour : selectedMinute;
      wheel.querySelectorAll(".android-time-wheel-option").forEach((option) => {
        const isSelected = Number(option.dataset.value) === selectedValue;
        option.classList.toggle("is-selected", isSelected);
        option.setAttribute("aria-selected", String(isSelected));
      });
    });
  }

  function syncWheelValue(wheel) {
    const maxValue = wheel.dataset.androidTimeWheel === "hour" ? 23 : 59;
    const value = Math.max(0, Math.min(maxValue, Math.round(wheel.scrollTop / ITEM_HEIGHT)));

    if (wheel.dataset.androidTimeWheel === "hour") {
      selectedHour = value;
    } else {
      selectedMinute = value;
    }

    updatePreview();
  }

  function scrollWheelsToSelection() {
    const picker = ensurePicker();
    const hourWheel = picker.querySelector('[data-android-time-wheel="hour"]');
    const minuteWheel = picker.querySelector('[data-android-time-wheel="minute"]');
    hourWheel.scrollTop = selectedHour * ITEM_HEIGHT;
    minuteWheel.scrollTop = selectedMinute * ITEM_HEIGHT;
    updatePreview();
  }

  function openPicker(input) {
    activeInput = input;
    const suggested = getSuggestedTime(input);
    selectedHour = suggested.hour;
    selectedMinute = suggested.minute;

    const picker = ensurePicker();
    picker.querySelector("#androidTimePickerTitle").textContent =
      input.id === "startTime" ? "选择开始时间" : "选择结束时间";
    picker.hidden = false;
    document.body.classList.add("android-wheel-picker-open");

    window.requestAnimationFrame(() => {
      scrollWheelsToSelection();
    });
  }

  function closePicker() {
    const picker = document.querySelector("#androidTimePicker");
    if (picker) {
      picker.hidden = true;
    }
    document.body.classList.remove("android-wheel-picker-open");
    activeInput = null;
  }

  function dispatchTimeChange(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyTime() {
    if (!activeInput) {
      closePicker();
      return;
    }

    activeInput.value = `${pad(selectedHour)}:${pad(selectedMinute)}`;
    dispatchTimeChange(activeInput);
    closePicker();
  }

  function clearTime() {
    if (activeInput) {
      activeInput.value = "";
      dispatchTimeChange(activeInput);
    }
    closePicker();
  }

  function enhanceInput(input) {
    if (!input || input.dataset.androidWheelReady === "true") {
      return;
    }

    input.dataset.androidWheelReady = "true";
    input.type = "text";
    input.readOnly = true;
    input.inputMode = "none";
    input.placeholder = "--:--";
    input.classList.add("android-wheel-time-input");
    input.setAttribute("aria-haspopup", "dialog");
    input.setAttribute("aria-expanded", "false");

    const wrapper = document.createElement("div");
    wrapper.className = "android-time-field";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.insertAdjacentHTML(
      "beforeend",
      '<span class="android-time-field-icon" aria-hidden="true">◷</span>'
    );

    const activate = (event) => {
      event.preventDefault();
      input.setAttribute("aria-expanded", "true");
      openPicker(input);
    };

    wrapper.addEventListener("pointerup", activate);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });
  }

  function initialize() {
    let found = 0;
    TIME_INPUT_IDS.forEach((id) => {
      const input = document.querySelector(`#${id}`);
      if (input) {
        enhanceInput(input);
        found += 1;
      }
    });

    if (found === TIME_INPUT_IDS.length) {
      ensurePicker();
      return true;
    }

    return false;
  }

  if (!initialize()) {
    const observer = new MutationObserver(() => {
      if (initialize()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
