const INITIALIZED_FLAG = "__LAB_SCHEDULER_LEGACY_INITIALIZED__";
const RUNTIME_KEY = "__LAB_SCHEDULER_RUNTIME__";
const PIPETTE_TIPS_CHECK_TEXT = "插好 5 mL 与 10 μL 枪头";
const CELL_ROOM_MOPPING_CHECK_TEXT = "细胞房拖地清洁";

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

function createRuntimeSource(source) {
  const preparedSource = downgradeRecoverableDatabaseLogs(
    ensureDutyChecklistSource(source)
  );

  return `(() => {
    const INITIALIZED_FLAG = ${JSON.stringify(INITIALIZED_FLAG)};
    const RUNTIME_KEY = ${JSON.stringify(RUNTIME_KEY)};

    if (window[INITIALIZED_FLAG]) {
      window.dispatchEvent(new Event("lab:app-ready"));
      return;
    }

    window[INITIALIZED_FLAG] = true;

    try {
      ${preparedSource}

      window[RUNTIME_KEY] = {
        get bookings() { return bookings; },
        get duties() { return duties; },
        get visibleWeekStart() { return visibleWeekStart; },
        get renderBookings() { return renderBookings; },
        set renderBookings(renderer) { renderBookings = renderer; },
        get renderDashboardBookings() { return renderDashboardBookings; },
        set renderDashboardBookings(renderer) { renderDashboardBookings = renderer; },
        get renderDuties() { return renderDuties; },
        set renderDuties(renderer) { renderDuties = renderer; },
        bookingList,
        dashboardBookingList,
        dashboardWeekRange,
        dutyList,
        dutyDateInput,
        dutyForm,
        ALL_DUTY_ITEMS,
        addDays,
        createDashboardEmptyState,
        createEmptyState,
        dateToString,
        escapeHtml,
        formatDate,
        formatShortDate,
        getBenchClass,
        getTodayString,
        padNumber,
        parseDateString,
        renderDutyChecklist,
        sortBookings,
        sortDuties
      };

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("lab:app-ready"));
      });
    } catch (error) {
      console.error("楷模实验室功能初始化失败：", error);
    }
  })();`;
}

export default function LegacyScriptRunner({ source }) {
  return (
    <script
      data-lab-scheduler-runtime="true"
      dangerouslySetInnerHTML={{ __html: createRuntimeSource(source) }}
    />
  );
}
