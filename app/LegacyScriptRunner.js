"use client";

import { useEffect } from "react";

const INITIALIZED_FLAG = "__LAB_SCHEDULER_LEGACY_INITIALIZED__";
const PIPETTE_TIPS_CHECK_TEXT = "插好 5 mL 与 10 μL 枪头";
const CELL_ROOM_MOPPING_CHECK_TEXT = "细胞房拖地清洁";

function createDutyOption(value) {
  const option = document.createElement("label");
  option.className = "duty-check-option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "duty-check-input";
  input.name = "dutyCheck";
  input.value = value;

  const text = document.createElement("span");
  text.textContent = value;

  option.append(input, text);
  return option;
}

function ensurePipetteTipsMarkup() {
  if (
    document.querySelector(
      `input[name="dutyCheck"][value="${PIPETTE_TIPS_CHECK_TEXT}"]`
    )
  ) {
    return;
  }

  const pipetteInput = document.querySelector(
    'input[name="dutyCheck"][value="移液器已归位"]'
  );
  const pipetteOption = pipetteInput?.closest("label.duty-check-option");

  if (!pipetteOption) {
    return;
  }

  pipetteOption.insertAdjacentElement(
    "afterend",
    createDutyOption(PIPETTE_TIPS_CHECK_TEXT)
  );
}

function ensureCellRoomMoppingMarkup() {
  if (
    document.querySelector(
      `input[name="dutyCheck"][value="${CELL_ROOM_MOPPING_CHECK_TEXT}"]`
    )
  ) {
    return;
  }

  const checklist = document.querySelector("#dutyForm .duty-checklist");
  if (!checklist) {
    return;
  }

  const group = document.createElement("fieldset");
  group.className = "duty-check-group duty-priority-group";
  group.setAttribute(
    "aria-label",
    `7. 值日重点：${CELL_ROOM_MOPPING_CHECK_TEXT}`
  );

  const priorityOption = createDutyOption(CELL_ROOM_MOPPING_CHECK_TEXT);
  priorityOption.classList.add("duty-priority-option");
  group.appendChild(priorityOption);
  checklist.appendChild(group);

  const abnormalLabel = document.querySelector(
    'label[for="dutyAbnormal"]'
  );
  if (abnormalLabel) {
    abnormalLabel.textContent = "异常记录";
  }
}

function ensureDutyChecklistMarkup() {
  ensurePipetteTipsMarkup();
  ensureCellRoomMoppingMarkup();

  const selectionCount = document.querySelector("#dutySelectionCount");
  if (selectionCount) {
    selectionCount.textContent = selectionCount.textContent.replace(
      /\/\d+ 项$/,
      "/18 项"
    );
  }
}

function ensurePipetteTipsSource(source) {
  if (source.includes(`"${PIPETTE_TIPS_CHECK_TEXT}"`)) {
    return source;
  }

  return source.replace(
    /("移液器已归位",)(\s*)"液氮罐液氮充足"/,
    (match, pipetteItem, spacing) =>
      `${pipetteItem}${spacing}"${PIPETTE_TIPS_CHECK_TEXT}",${spacing}"液氮罐液氮充足"`
  );
}

function ensureCellRoomMoppingSource(source) {
  if (source.includes(`"${CELL_ROOM_MOPPING_CHECK_TEXT}"`)) {
    return source;
  }

  return source.replace(
    /(\{\s*title:\s*"6\. 废弃物处理",\s*items:\s*\["废液桶和垃圾袋未过满、无泄漏"\]\s*\})(\s*\];)/,
    `$1,\n  {\n    title: "7. 值日重点",\n    items: ["${CELL_ROOM_MOPPING_CHECK_TEXT}"]\n  }$2`
  );
}

function ensureDutyChecklistSource(source) {
  return ensureCellRoomMoppingSource(ensurePipetteTipsSource(source));
}

function downgradeRecoverableDatabaseLogs(source) {
  const recoverableLogs = [
    ["console.error(`添加${labelText}失败：`, error);", "console.warn(`添加${labelText}失败：`, error);"],
    ["console.error(`删除${labelText}失败：`, error);", "console.warn(`删除${labelText}失败：`, error);"],
    ["console.error(`刷新${labelText}名单失败：`, error);", "console.warn(`刷新${labelText}名单失败：`, error);"],
    ["console.error(`初始化${labelText}名单失败：`, error);", "console.warn(`初始化${labelText}名单失败：`, error);"]
  ];

  return recoverableLogs.reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    source
  );
}

export default function LegacyScriptRunner({ source }) {
  useEffect(() => {
    if (window[INITIALIZED_FLAG]) {
      window.dispatchEvent(new Event("lab:app-ready"));
      return;
    }

    window[INITIALIZED_FLAG] = true;
    ensureDutyChecklistMarkup();

    const script = document.createElement("script");
    script.setAttribute("data-lab-scheduler-runtime", "true");
    script.textContent = downgradeRecoverableDatabaseLogs(
      ensureDutyChecklistSource(source)
    );
    document.body.appendChild(script);

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("lab:app-ready"));
    });
  }, [source]);

  return null;
}
