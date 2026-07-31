function __extractDutyPersonNames(duty) {
  if (Array.isArray(duty?.names)) {
    return duty.names
      .map((name) => String(name || "").trim().replace(/\s+/g, " "))
      .filter(Boolean);
  }

  return String(duty?.name || "")
    .split(/[、,，;；/]+/)
    .map((name) => String(name || "").trim().replace(/\s+/g, " "))
    .filter((name) => name && name !== "未填写");
}

window.__createLabPeoplePicker({
  type: "duty",
  inputSelector: "#dutyName",
  labelSelector: 'label[for="dutyName"]',
  form: dutyForm,
  messageElement: dutyMessage,
  labelText: "值日人",
  emptyText: "暂无值日人选项，请输入姓名创建。",
  addButtonText: "添加值日人",
  inputPlaceholder: "搜索或输入值日人姓名",
  storageKey: "labSchedulerDutyPeople",
  deletedStorageKey: "labSchedulerDeletedDutyPeople",
  migrationKey: "labSchedulerDutyPeopleMigratedToDatabase",
  optionsId: "dutyPeopleOptions",
  inputId: "dutyPersonNewName",
  buttonId: "addDutyPersonButton",
  selectDataAttribute: "duty-person-select",
  removeDataAttribute: "duty-person-remove",
  getRecords: () => duties,
  extractNames: __extractDutyPersonNames,
  refreshedEvent: "lab:duties-refreshed"
});
