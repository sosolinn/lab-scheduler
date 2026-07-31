function __extractBookingPersonNames(booking) {
  return String(booking?.name || "")
    .split(/[、,，;；/]+/)
    .map((name) => String(name || "").trim().replace(/\s+/g, " "))
    .filter((name) => name && name !== "未填写");
}

window.__createLabPeoplePicker({
  type: "booking",
  inputSelector: "#bookingName",
  labelSelector: 'label[for="bookingName"]',
  form: bookingForm,
  messageElement: bookingMessage,
  labelText: "预约人",
  emptyText: "暂无预约人选项，请输入姓名创建。",
  addButtonText: "添加预约人",
  inputPlaceholder: "搜索或输入预约人姓名",
  storageKey: "labSchedulerBookingPeople",
  deletedStorageKey: "labSchedulerDeletedBookingPeople",
  migrationKey: "labSchedulerBookingPeopleMigratedToDatabase",
  optionsId: "bookingPeopleOptions",
  inputId: "bookingPersonNewName",
  buttonId: "addBookingPersonButton",
  selectDataAttribute: "booking-person-select",
  removeDataAttribute: "booking-person-remove",
  getRecords: () => bookings,
  extractNames: __extractBookingPersonNames,
  refreshedEvent: "lab:bookings-refreshed"
});
