export const paginationOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        { text: "⏪", callback_data: "pagefirst" },
        { text: "◀️", callback_data: "pageprevious" },
        { text: "▶️", callback_data: "pagenext" },
        { text: "⏩", callback_data: "pagelast" },
      ],
      [{ text: "Главное меню 🔙", callback_data: "Назад 🔙" }],
    ],
  }),
};
export const deleteMenu = {
  reply_markup: JSON.stringify({
    remove_keyboard: true,
  }),
};
export const forceReplyForCreateNewPrice = {
  reply_markup: JSON.stringify({
    force_reply: true,
    input_field_placeholder: "Введите значение...",
  }),
};
export const mainOptions = {
  disable_notification: true,
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: "Все прайсы 📋" }],
      [{ text: "Поиск прайса 🔍" }],
      [{ text: "Добавить прайс ➕" }],
      [{ text: "Редактировать прайс ✏️" }],
      [{ text: "Удалить прайс 🗑️" }],
      [{ text: "Помощь ℹ️" }],
      [{ text: "Скачать XML price 💾" }],
      [{ text: "Настройки ⚙️" }],
      [{ text: "Закрыть меню ⛔️" }],
      [{ text: "ВЫЙТИ 🚪" }],
    ],
    resize_keyboard: true,
  }),
};
export const goBackOption = {
  reply_markup: JSON.stringify({
    inline_keyboard: [[{ text: "Главное меню 🔙", callback_data: "Назад 🔙" }]],
  }),
};
export const searchResultOption = {
  disable_notification: true,
  reply_markup: JSON.stringify({
    keyboard: [[{ text: "Поиск прайса 🔍" }], [{ text: "Назад 🔙" }]],
    resize_keyboard: true,
  }),
};
export const goBackAndConfirmOption = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [{ text: "Подтвердить ✔️", callback_data: "confirm newprice" }],
      [{ text: "Главное меню 🔙", callback_data: "Назад 🔙" }],
    ],
  }),
};
