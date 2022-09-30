import TelegramApi from "node-telegram-bot-api";
import mysql from "mysql2/promise";
import {
  paginationOptions,
  mainOptions,
  deleteMenu,
  forceReplyForCreateNewPrice,
  goBackOption,
  searchResultOption,
  goBackAndConfirmOption,
} from "./KeyboardOptions.js";
import {
  searchPrices,
  searchPricesById,
  editPrices,
  paginatePrices,
} from "./PriceService.js";
import {
  checkForAuth,
  login,
  logout,
  getTableName,
  registration,
} from "./AuthService.js";
import Stickers from "./Stickers.js";
import { token as TOKEN } from "./Token.js";

export const conn = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  database: "kaspi_price_list",
  port: "3306",
  password: "",
});

const bot = new TelegramApi(TOKEN, { polling: true });
const localStorage = {};
const replytimeout = 20; //В секундах
const moreinfo = 'Подробнее <a href="https://kaspi.kz">+7 (776) 829 08 79</a>';

const unauthorizedMenu = [
  { command: "/start", description: "Запустить бота" },
  {
    command: "/info",
    description: "Получить дополнительную информацию",
  },
];
const authorizedMenu = [
  { command: "/start", description: "Запустить бота" },
  { command: "/menu", description: "Главное меню" },
  { command: "/info", description: "Получить дополнительную информацию" },
  { command: "/exit", description: "Выйти из меню" },
];

const removeReplyListener = (id) => {
  bot.removeReplyListener(id);
};

const start = async () => {
  {
    bot.on("message", async (msg) => {
      bot.removeAllListeners("poll_answer");
      const text = msg.text;
      const chatId = msg.chat.id;
      const isAuth = await checkForAuth(msg.from.id);
      if (!isAuth) {
        bot.setMyCommands(unauthorizedMenu);
        if (msg.reply_to_message) {
          return;
        }
        if (text === "/info") {
          await bot.sendMessage(chatId, moreinfo, { parse_mode: "HTML" });
          return;
        }
        if (text !== "/start") {
          return;
        }
        await bot.sendSticker(chatId, Stickers.keyBoyBeingShy);
        await bot.sendMessage(chatId, "Вы не авторизованы.", {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: "Войти", callback_data: "login" }],
              [{ text: "Зарегистрироваться", callback_data: "empty" }],
            ],
          }),
        });
        return;
      }
      bot.setMyCommands(authorizedMenu);
      if (msg.sticker) {
        console.log(msg.sticker);
      }
      if (text === "/info") {
        await bot.sendMessage(chatId, moreinfo, { parse_mode: "HTML" });
        return;
      }
      if (text === "/start") {
        await bot.sendSticker(chatId, Stickers.keyBoySmiling);
        await bot.sendMessage(
          chatId,
          "Привет, бот уже работает. \nНажми /menu для вывода Главного меню."
        );
        return;
      }
      if (text === "/menu" && !msg.reply_to_message) {
        if (localStorage[chatId]) {
          if (localStorage[chatId].newprice) {
            try {
              await bot.deleteMessage(
                chatId,
                localStorage[chatId].newprice_message_id
              );
            } catch (e) {
              console.log;
            }
            delete localStorage[chatId].newprice;
          }
          if (localStorage[chatId].page || localStorage[chatId.total]) {
            try {
              await bot.deleteMessage(
                chatId,
                localStorage[chatId].pricespageid
              );
            } catch (e) {
              console.log;
            }
          }
        }
        await bot.sendMessage(
          chatId,
          "Вы находитесь в Главном меню:",
          mainOptions
        );
        return;
      } else if (text === "/exit" && !msg.reply_to_message) {
        return bot.sendMessage(chatId, "До свидания 👋", deleteMenu);
      } else if (text === "Назад 🔙" && !msg.reply_to_message) {
        await bot.sendMessage(
          chatId,
          "Вы находитесь в Главном меню:",
          mainOptions
        );
        return;
      } else if (text === "Все прайсы 📋" && !msg.reply_to_message) {
        if (localStorage[chatId]) {
          if (localStorage[chatId].newprice) {
            try {
              await bot.deleteMessage(
                chatId,
                localStorage[chatId].newprice_message_id
              );
            } catch (e) {
              console.log;
            }
            delete localStorage[chatId].newprice;
          }
          if (localStorage[chatId].page || localStorage[chatId.total]) {
            try {
              await bot.deleteMessage(
                chatId,
                localStorage[chatId].pricespageid
              );
            } catch (e) {
              console.log;
            }
          }
        }
        const tablename = await getTableName(msg.from.id);
        const { finalmsg, total } = await paginatePrices(0, 10, tablename);
        localStorage[chatId] = { page: 1, total };
        await bot
          .sendMessage(chatId, "Загрузка...", { ...deleteMenu })
          .then(async (msg) => {
            await bot.deleteMessage(chatId, msg.message_id);
          });
        await bot
          .sendMessage(chatId, finalmsg, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            disable_notification: true,
            ...paginationOptions,
          })
          .then((msg) => {
            localStorage[chatId].pricespageid = msg.message_id;
          });
        return;
      } else if (text === "Поиск прайса 🔍" && !msg.reply_to_message) {
        await bot
          .sendMessage(chatId, "Введите пожалуйста модель или SKU:", {
            ...forceReplyForCreateNewPrice,
          })
          .then((msg2) => {
            const replylistenerid = bot.onReplyToMessage(
              msg2.chat.id,
              msg2.message_id,
              async (msg) => {
                bot.removeReplyListener(replylistenerid);
                const tablename = await getTableName(msg.from.id);
                const result = await searchPrices(msg.text, tablename);
                bot.sendMessage(msg2.chat.id, result, {
                  parse_mode: "HTML",
                  disable_notification: true,
                  ...searchResultOption,
                });
              }
            );
            setTimeout(
              removeReplyListener,
              replytimeout * 1000,
              replylistenerid
            );
          });
        return;
      } else if (text === "Добавить прайс ➕" && !msg.reply_to_message) {
        const newprice = {};
        await bot
          .sendMessage(chatId, "Введите идентификатор прайса: (только цифры)", {
            ...forceReplyForCreateNewPrice,
          })
          .then((msg2) => {
            const replylistenerid1 = bot.onReplyToMessage(
              msg2.chat.id,
              msg2.message_id,
              async (msg) => {
                bot.removeReplyListener(replylistenerid1);
                if (!/[0-9]/.test(msg.text)) {
                  await bot.sendMessage(
                    msg2.chat.id,
                    "SKU принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                    mainOptions
                  );
                  return;
                }
                newprice.suk = msg.text;
                await bot
                  .sendMessage(
                    msg2.chat.id,
                    "Введите наименование прайса в вашем магазине:",
                    {
                      ...forceReplyForCreateNewPrice,
                    }
                  )
                  .then(async (msg2) => {
                    const replylistenerid2 = bot.onReplyToMessage(
                      msg2.chat.id,
                      msg2.message_id,
                      async (msg) => {
                        bot.removeReplyListener(replylistenerid2);
                        newprice.suk2 = msg.text;
                        await bot
                          .sendMessage(
                            msg2.chat.id,
                            "Введите модель товара: (не более 150 символов)",
                            {
                              ...forceReplyForCreateNewPrice,
                            }
                          )
                          .then(async (msg2) => {
                            const replylistenerid3 = bot.onReplyToMessage(
                              msg2.chat.id,
                              msg2.message_id,
                              async (msg) => {
                                bot.removeReplyListener(replylistenerid3);
                                if (msg.text.length > 150) {
                                  await bot.sendMessage(
                                    msg2.chat.id,
                                    "Модель товара не может быть длиннее 150 символов!\n\nВы вернулись в Главное меню.",
                                    mainOptions
                                  );
                                  return;
                                }
                                newprice.model = msg.text;
                                await bot
                                  .sendMessage(
                                    msg2.chat.id,
                                    "Введите бренд товара: (не более 25 символов)",
                                    {
                                      ...forceReplyForCreateNewPrice,
                                    }
                                  )
                                  .then(async (msg2) => {
                                    const replylistenerid4 =
                                      bot.onReplyToMessage(
                                        msg2.chat.id,
                                        msg2.message_id,
                                        async (msg) => {
                                          bot.removeReplyListener(
                                            replylistenerid4
                                          );
                                          if (msg.text.length > 25) {
                                            await bot.sendMessage(
                                              msg2.chat.id,
                                              "Бренд товара не может быть длиннее 25 символов!\n\nВы вернулись в Главное меню.",
                                              mainOptions
                                            );
                                            return;
                                          }
                                          newprice.brand = msg.text;
                                          await bot
                                            .sendMessage(
                                              msg2.chat.id,
                                              "Введите минимальную цену товара: (только цифры)",
                                              { ...forceReplyForCreateNewPrice }
                                            )
                                            .then(async (msg2) => {
                                              const replylistenerid5 =
                                                bot.onReplyToMessage(
                                                  msg2.chat.id,
                                                  msg2.message_id,
                                                  async (msg) => {
                                                    bot.removeReplyListener(
                                                      replylistenerid5
                                                    );
                                                    if (
                                                      !/[0-9]/.test(msg.text)
                                                    ) {
                                                      await bot.sendMessage(
                                                        msg2.chat.id,
                                                        "Цена принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                                                        mainOptions
                                                      );
                                                      return;
                                                    }
                                                    newprice.minprice =
                                                      parseInt(msg.text);
                                                    await bot
                                                      .sendMessage(
                                                        msg2.chat.id,
                                                        "Введите максимальную цену товара:\n(только цифры, не может быть меньше минимальной цены)",
                                                        {
                                                          ...forceReplyForCreateNewPrice,
                                                        }
                                                      )
                                                      .then(async (msg2) => {
                                                        const replylistenerid6 =
                                                          bot.onReplyToMessage(
                                                            msg2.chat.id,
                                                            msg2.message_id,
                                                            async (msg) => {
                                                              bot.removeReplyListener(
                                                                replylistenerid6
                                                              );
                                                              if (
                                                                !/[0-9]/.test(
                                                                  msg.text
                                                                )
                                                              ) {
                                                                await bot.sendMessage(
                                                                  msg2.chat.id,
                                                                  "Цена принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                                                                  mainOptions
                                                                );
                                                                return;
                                                              }
                                                              if (
                                                                parseInt(
                                                                  msg.text
                                                                ) <=
                                                                newprice.minprice
                                                              ) {
                                                                await bot.sendMessage(
                                                                  msg2.chat.id,
                                                                  "Максимальная цена не может быть меньше минимальной или быть ей равной!\n\nВы вернулись в Главное меню.",
                                                                  mainOptions
                                                                );
                                                                return;
                                                              }
                                                              newprice.maxprice =
                                                                parseInt(
                                                                  msg.text
                                                                );
                                                              localStorage[
                                                                chatId
                                                              ] = {
                                                                ...localStorage[
                                                                  chatId
                                                                ],
                                                                newprice,
                                                              };
                                                              localStorage[
                                                                chatId
                                                              ] = {
                                                                ...localStorage[
                                                                  chatId
                                                                ],
                                                                availabilityOptions:
                                                                  {
                                                                    inline_keyboard:
                                                                      [
                                                                        [
                                                                          {
                                                                            text: "PP1-",
                                                                            callback_data:
                                                                              "PP1 add",
                                                                          },
                                                                          {
                                                                            text: "PP2-",
                                                                            callback_data:
                                                                              "PP2 add",
                                                                          },
                                                                          {
                                                                            text: "PP3-",
                                                                            callback_data:
                                                                              "PP3 add",
                                                                          },
                                                                          {
                                                                            text: "PP4-",
                                                                            callback_data:
                                                                              "PP4 add",
                                                                          },
                                                                          {
                                                                            text: "PP5-",
                                                                            callback_data:
                                                                              "PP5 add",
                                                                          },
                                                                        ],
                                                                        [
                                                                          {
                                                                            text: "Дальше ✔️",
                                                                            callback_data:
                                                                              "save storages",
                                                                          },
                                                                        ],
                                                                        [
                                                                          {
                                                                            text: "Назад 🔙",
                                                                            callback_data:
                                                                              "Назад 🔙",
                                                                          },
                                                                        ],
                                                                      ],
                                                                  },
                                                              };
                                                              await bot
                                                                .sendMessage(
                                                                  msg2.chat.id,
                                                                  "Выберите склады: ",
                                                                  {
                                                                    reply_markup:
                                                                      JSON.stringify(
                                                                        localStorage[
                                                                          chatId
                                                                        ]
                                                                          .availabilityOptions
                                                                      ),
                                                                  }
                                                                )
                                                                .then((msg) => {
                                                                  localStorage[
                                                                    chatId
                                                                  ].newprice_message_id =
                                                                    msg.message_id;
                                                                });
                                                            }
                                                          );
                                                        setTimeout(
                                                          removeReplyListener,
                                                          replytimeout * 1000,
                                                          replylistenerid6
                                                        );
                                                      });
                                                  }
                                                );
                                              setTimeout(
                                                removeReplyListener,
                                                replytimeout * 1000,
                                                replylistenerid5
                                              );
                                            });
                                        }
                                      );
                                    setTimeout(
                                      removeReplyListener,
                                      replytimeout * 1000,
                                      replylistenerid4
                                    );
                                  });
                              }
                            );
                            setTimeout(
                              removeReplyListener,
                              replytimeout * 1000,
                              replylistenerid3
                            );
                          });
                      }
                    );
                    setTimeout(
                      removeReplyListener,
                      replytimeout * 1000,
                      replylistenerid2
                    );
                  });
              }
            );
            setTimeout(
              removeReplyListener,
              replytimeout * 1000,
              replylistenerid1
            );
          });
      } else if (text === "Удалить прайс 🗑️" && !msg.reply_to_message) {
        await bot
          .sendMessage(
            chatId,
            "Введите ID удаляемого Прайса: (только цифры)",
            forceReplyForCreateNewPrice
          )
          .then(async (msg2) => {
            const replylistenerid = bot.onReplyToMessage(
              msg2.chat.id,
              msg2.message_id,
              async (msg) => {
                if (!/[0-9]/.test(msg.text)) {
                  await bot.sendMessage(
                    msg2.chat.id,
                    "ID принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                    mainOptions
                  );
                  bot.removeReplyListener(replylistenerid);
                  return;
                }
                bot.removeReplyListener(replylistenerid);
                const tablename = await getTableName(msg.from.id);
                const result = await searchPricesById(msg.text, tablename);
                if (result.startsWith("По запросу")) {
                  await bot.sendMessage(msg2.chat.id, result, {
                    ...goBackOption,
                  });
                  return;
                }
                await bot.sendMessage(msg2.chat.id, result, {
                  parse_mode: "HTML",
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [
                        {
                          text: "Вы действительно хотите удалить этот Прайс?",
                          callback_data: "empty",
                        },
                      ],
                      [
                        { text: "Нет", callback_data: "Назад 🔙" },
                        { text: " ", callback_data: "empty" },
                        {
                          text: "Да",
                          callback_data: "deleteprice " + msg.text,
                        },
                      ],
                      [{ text: "Главное меню 🔙", callback_data: "Назад 🔙" }],
                    ],
                  }),
                });
              }
            );
            setTimeout(
              removeReplyListener,
              replytimeout * 1000,
              replylistenerid
            );
          });
        return;
      } else if (text === "Редактировать прайс ✏️" && !msg.reply_to_message) {
        await bot
          .sendMessage(
            chatId,
            "Введите ID редактируемого Прайса: (только цифры)",
            forceReplyForCreateNewPrice
          )
          .then(async (msg2) => {
            const replylistenerid = bot.onReplyToMessage(
              msg2.chat.id,
              msg2.message_id,
              async (msg) => {
                if (!/[0-9]/.test(msg.text)) {
                  await bot.sendMessage(
                    msg2.chat.id,
                    "ID принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                    mainOptions
                  );
                  bot.removeReplyListener(replylistenerid);
                  return;
                }
                bot.removeReplyListener(replylistenerid);
                const tablename = await getTableName(msg.from.id);
                const result = await searchPricesById(msg.text, tablename);
                if (result.startsWith("По запросу")) {
                  await bot.sendMessage(msg2.chat.id, result, {
                    ...goBackOption,
                  });
                  return;
                }
                await bot.sendMessage(msg2.chat.id, result, {
                  parse_mode: "HTML",
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [
                        {
                          text: "Выберите поле для редактирования:",
                          callback_data: "empty",
                        },
                      ],
                      [
                        {
                          text: "SKU",
                          callback_data: "editprice sku " + msg.text,
                        },
                        {
                          text: "Имя в вашей системе",
                          callback_data: "editprice name " + msg.text,
                        },
                      ],
                      [
                        {
                          text: "Модель",
                          callback_data: "editprice model " + msg.text,
                        },
                        {
                          text: "Brand",
                          callback_data: "editprice brand " + msg.text,
                        },
                      ],
                      [
                        {
                          text: "Минимальная цена",
                          callback_data: "editprice minprice " + msg.text,
                        },
                        {
                          text: "Максимальная цена",
                          callback_data: "editprice maxprice " + msg.text,
                        },
                      ],
                      [
                        {
                          text: "Доступность в складах",
                          callback_data: "editprice availability " + msg.text,
                        },
                        {
                          text: "URL (не рекомендуется редактировать)",
                          callback_data: "editprice url " + msg.text,
                        },
                      ],
                      [{ text: "Главное меню 🔙", callback_data: "Назад 🔙" }],
                    ],
                  }),
                });
              }
            );
            setTimeout(
              removeReplyListener,
              replytimeout * 1000,
              replylistenerid
            );
          });
        return;
      } else if (text === "Помощь ℹ️" && !msg.reply_to_message) {
        await bot.sendSticker(chatId, Stickers.keyBoyBeingTongue);
        await bot
          .sendMessage(chatId, "Загрузка...", {
            ...deleteMenu,
          })
          .then(async (msg2) => {
            await bot.deleteMessage(chatId, msg2.message_id);
          });
        await bot.sendMessage(chatId, "Дополнительная информация...", {
          ...goBackOption,
        });
      } else if (text === "Настройки ⚙️" && !msg.reply_to_message) {
        await bot
          .sendMessage(chatId, "Загрузка...", {
            ...deleteMenu,
          })
          .then(async (msg2) => {
            await bot.deleteMessage(chatId, msg2.message_id);
          });
        await bot.sendMessage(chatId, "Настройки...", {
          ...goBackOption,
        });
      } else if (text === "Скачать XML price 💾" && !msg.reply_to_message) {
        await bot
          .sendMessage(chatId, "Загрузка...", {
            ...deleteMenu,
          })
          .then(async (msg2) => {
            await bot.deleteMessage(chatId, msg2.message_id);
          });
        await bot.sendMessage(chatId, "Файл...", {
          ...goBackOption,
        });
      } else if (text === "Закрыть меню ⛔️" && !msg.reply_to_message) {
        await bot
          .sendMessage(chatId, "Выходим с меню...", deleteMenu)
          .then(async (msg) => {
            await bot.deleteMessage(chatId, msg.message_id);
          });
        return;
      } else if (text === "ВЫЙТИ 🚪" && !msg.reply_to_message) {
        await bot.sendMessage(
          chatId,
          "Вы действительно хотите выйти из аккаунта?",
          {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: "Нет", callback_data: "Назад 🔙" },
                  { text: " ", callback_data: "empty" },
                  { text: "Да", callback_data: "logout" },
                ],
                [{ text: "Главное меню 🔙", callback_data: "Назад 🔙" }],
              ],
            }),
          }
        );
        return;
      }
    });
  }

  bot.on("callback_query", async (msg) => {
    const data = msg.data;
    const chatId = msg.message.chat.id;
    if (data === "login") {
      try {
        await bot.deleteMessage(chatId, msg.message.message_id);
      } catch (e) {
        return;
      }
      await bot
        .sendMessage(
          chatId,
          msg.from.id + ": " + msg.from.first_name + "? Введите пароль:",
          { ...forceReplyForCreateNewPrice }
        )
        .then(async (msg2) => {
          const replylistenerid = bot.onReplyToMessage(
            msg2.chat.id,
            msg2.message_id,
            async (msg) => {
              bot.removeReplyListener(replylistenerid);
              const response = await login(msg.from.id, msg.text);
              if (response.startsWith("Вы успешно")) {
                bot.setMyCommands(authorizedMenu);
                await bot.sendSticker(chatId, Stickers.keyBoyCheering);
              }
              await bot.sendMessage(chatId, response);
            }
          );
          setTimeout(removeReplyListener, replytimeout * 1000, replylistenerid);
        });
      return;
    }
    const isAuth = await checkForAuth(msg.from.id);
    if (!isAuth) {
      if (data === "empty") {
        data;
        await bot.answerCallbackQuery(msg.id, { text: "empty" });
        return;
      }
      bot.answerCallbackQuery(msg.id, { text: "Ошибка! Вы не авторизованы." });
      bot.setMyCommands(unauthorizedMenu);
      return;
    }

    if (data === "logout") {
      try {
        await bot.deleteMessage(chatId, msg.message.message_id);
      } catch (e) {
        return;
      }
      await logout(msg.from.id);
      await bot.sendMessage(
        chatId,
        "Вы вышли из аккаунты и больше не авторизованы.",
        deleteMenu
      );
      bot.setMyCommands(unauthorizedMenu);
      return;
    }

    if (data === "Назад 🔙") {
      await bot.sendMessage(
        chatId,
        "Вы находитесь в главном меню:",
        mainOptions
      );
      try {
        delete localStorage[chatId].page;
        delete localStorage[chatId].total;
        delete localStorage[chatId].newprice;
      } catch (e) {
        e;
      }
      await bot.deleteMessage(chatId, msg.message.message_id);
      await bot.answerCallbackQuery(msg.id, { text: "Back" });
      return;
    }
    if (data === "pagefirst" && localStorage[chatId]) {
      if (localStorage[chatId].page === 1) {
        return bot.answerCallbackQuery(msg.id, { text: "first page" });
      }
      localStorage[chatId].page = 1;
      const tablename = await getTableName(msg.from.id);
      const { finalmsg, total } = await paginatePrices(
        (localStorage[chatId].page - 1) * 10,
        localStorage[chatId].page * 10,
        tablename
      );
      localStorage[chatId].total = total;
      await bot.editMessageText(finalmsg, {
        chat_id: chatId,
        message_id: msg.message.message_id,
        ...paginationOptions,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: true,
      });
      await bot.answerCallbackQuery(msg.id, { text: "pagefirst" });
      return;
    }
    if (data === "pageprevious" && localStorage[chatId]) {
      if (localStorage[chatId].page <= 1) {
        return bot.answerCallbackQuery(msg.id, { text: "first page" });
      }
      localStorage[chatId].page = localStorage[chatId].page - 1;
      const tablename = await getTableName(msg.from.id);
      const { finalmsg, total } = await paginatePrices(
        (localStorage[chatId].page - 1) * 10,
        localStorage[chatId].page * 10,
        tablename
      );
      localStorage[chatId].total = total;
      await bot.editMessageText(finalmsg, {
        chat_id: chatId,
        message_id: msg.message.message_id,
        ...paginationOptions,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: true,
      });
      await bot.answerCallbackQuery(msg.id, { text: "pageprev" });
      return;
    }
    if (data === "pagenext" && localStorage[chatId]) {
      if (localStorage[chatId].page >= localStorage[chatId].total) {
        return bot.answerCallbackQuery(msg.id, { text: "last page" });
      }
      localStorage[chatId].page = localStorage[chatId].page + 1;
      const tablename = await getTableName(msg.from.id);
      const { finalmsg, total } = await paginatePrices(
        (localStorage[chatId].page - 1) * 10,
        localStorage[chatId].page * 10,
        tablename
      );
      localStorage[chatId].total = total;
      await bot.editMessageText(finalmsg, {
        chat_id: chatId,
        message_id: msg.message.message_id,
        ...paginationOptions,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: true,
      });
      await bot.answerCallbackQuery(msg.id, { text: "pagenext" });
      return;
    }
    if (data === "pagelast" && localStorage[chatId]) {
      if (localStorage[chatId].page === localStorage[chatId].total) {
        return bot.answerCallbackQuery(msg.id, { text: "last page" });
      }
      localStorage[chatId].page = localStorage[chatId]
        ? localStorage[chatId].total
        : 1;
      const tablename = await getTableName(msg.from.id);
      const { finalmsg, total } = await paginatePrices(
        (localStorage[chatId].page - 1) * 10,
        localStorage[chatId].page * 10,
        tablename
      );
      localStorage[chatId].total = total;
      await bot.editMessageText(finalmsg, {
        chat_id: chatId,
        message_id: msg.message.message_id,
        ...paginationOptions,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: true,
      });
      await bot.answerCallbackQuery(msg.id, { text: "pagelast" });
      return;
    }
    if (/PP[1-5] add/.test(data)) {
      const storageNumber = parseInt(data.replace(/[A-z\s]/gi, ""));
      if (!localStorage[chatId]) {
        await bot.answerCallbackQuery(msg.id, { text: "no newprice" });
        return;
      }
      if (
        localStorage[chatId].availabilityOptions.inline_keyboard[0][
          storageNumber - 1
        ].text === `PP${storageNumber}-`
      ) {
        localStorage[chatId].availabilityOptions.inline_keyboard[0][
          storageNumber - 1
        ].text = `PP${storageNumber}+`;
      } else {
        localStorage[chatId].availabilityOptions.inline_keyboard[0][
          storageNumber - 1
        ].text = `PP${storageNumber}-`;
      }
      await bot.editMessageText("Выберите склады:\n", {
        chat_id: chatId,
        message_id: msg.message.message_id,
        reply_markup: JSON.stringify(localStorage[chatId].availabilityOptions),
      });
      await bot.answerCallbackQuery(msg.id, { text: "edited" });
      return;
    }
    if (data === "save storages") {
      if (!localStorage[chatId]) {
        await bot.answerCallbackQuery(msg.id, { text: "no newprice" });
        return;
      }
      localStorage[chatId].newprice.actualprice =
        localStorage[chatId].newprice.minprice;
      const availabilities = [];
      for (let itr = 1; itr <= 5; itr++) {
        if (
          localStorage[chatId].availabilityOptions.inline_keyboard[0][
            itr - 1
          ].text.endsWith("+")
        ) {
          availabilities.push({ $: { storeId: "PP" + itr, available: "yes" } });
          localStorage[chatId].newprice[
            "availability" + (itr === 1 ? "" : itr)
          ] = JSON.stringify({ $: { storeId: "PP" + itr, available: "yes" } });
        } else {
          availabilities.push({ $: { storeId: "PP" + itr, available: "no" } });
          localStorage[chatId].newprice[
            "availability" + (itr === 1 ? "" : itr)
          ] = JSON.stringify({ $: { storeId: "PP" + itr, available: "no" } });
        }
      }
      localStorage[
        chatId
      ].newprice.url = `https://kaspi.kz/shop/p/-${localStorage[chatId].newprice.suk}/?c=710000000#!/sellers/${localStorage[chatId].newprice.suk}`;
      const temp = localStorage[chatId].newprice;
      let finalmsg = "";
      let availability = "";
      for (let i = 0; i < 5; i++) {
        if (availabilities[i].$.available === "yes") {
          availability += "PP" + (i + 1) + "(+)";
        } else {
          availability += "PP" + (i + 1) + "(-)";
        }
      }
      finalmsg += `🔸 <a href="${temp.url}">${temp.model}</a> - ${temp.suk} - MIN: ${temp.minprice}тг - NOW: ${temp.actualprice}тг - MAX: ${temp.maxprice}тг - AVL: ${availability}\n`;
      finalmsg = "Проверьте, пожалуйста, введенные данные:\n" + finalmsg;

      await bot.editMessageText(finalmsg, {
        parse_mode: "HTML",
        chat_id: chatId,
        message_id: msg.message.message_id,
        ...goBackAndConfirmOption,
      });
      await bot.answerCallbackQuery(msg.id, { text: "saved" });
      return;
    }
    if (data === "confirm newprice") {
      if (!localStorage[chatId]) {
        await bot.answerCallbackQuery(msg.id, { text: "no newprice" });
        return;
      }
      let response = undefined;
      try {
        const tablename = await getTableName(msg.from.id);
        await conn.query(
          `INSERT INTO ${tablename} SET ?`,
          localStorage[chatId].newprice
        );
      } catch (e) {
        response = e;
      }
      await bot.editMessageText(
        response
          ? "Ошибка!\n" +
              response.toString() +
              "\nПожалуйста, попробуйте еще раз."
          : "Поздравляем! Ваш Новый Прайс был успешно выгружен в базу данных.",
        {
          chat_id: chatId,
          message_id: msg.message.message_id,
          ...goBackOption,
        }
      );
      await bot.answerCallbackQuery(msg.id, {
        text: "saved",
      });
      return;
    }
    if (data === "empty") {
      data;
      await bot.answerCallbackQuery(msg.id, {
        text: "empty",
      });
      return;
    }
    if (data.startsWith("editprice")) {
      const splittedData = data.split(" ");
      const [operation, id] = [splittedData[1], splittedData[2]];
      switch (operation) {
        case "sku":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(chatId, "Введите новое значение SKU: (только цифры)", {
              ...forceReplyForCreateNewPrice,
            })
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  bot.removeReplyListener(replylistenerid);
                  if (!/[0-9]/.test(msg.text)) {
                    await bot.sendMessage(
                      msg2.chat.id,
                      "SKU принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                      mainOptions
                    );
                    return;
                  }
                  const tablename = await getTableName(msg.from.id);
                  const result = await editPrices(
                    "suk",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "name":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(chatId, "Введите новое значение наименования: ", {
              ...forceReplyForCreateNewPrice,
            })
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  bot.removeReplyListener(replylistenerid);
                  const tablename = await getTableName(msg.from.id);
                  const result = await editPrices(
                    "suk2",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "model":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(chatId, "Введите новое значение модели: ", {
              ...forceReplyForCreateNewPrice,
            })
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  bot.removeReplyListener(replylistenerid);
                  const tablename = await getTableName(msg.from.id);
                  const result = await editPrices(
                    "model",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "brand":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(chatId, "Введите новое значение бренда: ", {
              ...forceReplyForCreateNewPrice,
            })
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  bot.removeReplyListener(replylistenerid);
                  const tablename = await getTableName(msg.from.id);
                  const result = await editPrices(
                    "brand",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "url":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(chatId, "Введите новое значение URL: ", {
              ...forceReplyForCreateNewPrice,
            })
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  bot.removeReplyListener(replylistenerid);
                  const tablename = await getTableName(msg.from.id);
                  const result = await editPrices(
                    "url",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "minprice":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(
              chatId,
              "Введите новую минимальную цену: \n(только цифры, не может быть больше максимальной цены)",
              {
                ...forceReplyForCreateNewPrice,
              }
            )
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  if (!/[0-9]/.test(msg.text)) {
                    await bot.sendMessage(
                      msg2.chat.id,
                      "Цена принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                      mainOptions
                    );
                    return;
                  }
                  const tablename = await getTableName(msg.from.id);
                  const { maxprice } = (
                    await conn.query(
                      `SELECT maxprice FROM ${tablename} WHERE id = ${id}`
                    )
                  )[0][0];
                  if (parseInt(msg.text) >= parseInt(maxprice)) {
                    await bot.sendMessage(
                      msg2.chat.id,
                      "Минимальная цена не может быть больше максимальной или быть ей равной!\n\nВы вернулись в Главное меню.",
                      mainOptions
                    );
                    return;
                  }
                  bot.removeReplyListener(replylistenerid);
                  const result = await editPrices(
                    "minprice",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "maxprice":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendMessage(
              chatId,
              "Введите новую максимальную цену: \n(только цифры, не может быть меньше минимальной цены)",
              {
                ...forceReplyForCreateNewPrice,
              }
            )
            .then(async (msg2) => {
              const replylistenerid = bot.onReplyToMessage(
                msg2.chat.id,
                msg2.message_id,
                async (msg) => {
                  if (!/[0-9]/.test(msg.text)) {
                    await bot.sendMessage(
                      msg2.chat.id,
                      "Цена принимает только цифровые значения!\n\nВы вернулись в Главное меню.",
                      mainOptions
                    );
                    return;
                  }
                  const tablename = await getTableName(msg.from.id);
                  const { minprice } = (
                    await conn.query(
                      `SELECT minprice FROM ${tablename} WHERE id = ${id}`
                    )
                  )[0][0];
                  if (parseInt(msg.text) <= parseInt(minprice)) {
                    await bot.sendMessage(
                      msg2.chat.id,
                      "Максимальная цена не может быть меньше минимальной или быть ей равной!\n\nВы вернулись в Главное меню.",
                      mainOptions
                    );
                    return;
                  }
                  bot.removeReplyListener(replylistenerid);
                  const result = await editPrices(
                    "maxprice",
                    msg.text,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    {
                      ...goBackOption,
                    }
                  );
                }
              );
              setTimeout(
                removeReplyListener,
                replytimeout * 1000,
                replylistenerid
              );
            });
          break;
        case "availability":
          try {
            await bot.deleteMessage(chatId, msg.message.message_id);
          } catch (e) {
            return;
          }
          await bot
            .sendPoll(
              chatId,
              "Выберите склады: ",
              ["PP1", "PP2", "PP3", "PP4", "PP5"],
              {
                is_anonymous: false,
                allows_multiple_answers: true,
                type: "regular",
                open_period: 600,
                disable_notification: true,
                ...goBackOption,
              }
            )
            .then(async (msg2) => {
              bot.on("poll_answer", async (query) => {
                if (msg.from.id === query.user.id) {
                  try {
                    await bot.deleteMessage(chatId, msg2.message_id);
                  } catch (e) {
                    e;
                  }
                  const tablename = await getTableName(msg.from.id);
                  const result = await editPrices(
                    "availabilities",
                    query.option_ids,
                    id,
                    tablename
                  );
                  await bot.sendMessage(
                    chatId,
                    result.sqlMessage
                      ? result.sqlMessage
                      : "Прайс успешно отредактирован.",
                    goBackOption
                  );
                }
              });
            });
          break;
        default:
          console.log(operation, id);
          await bot.answerCallbackQuery(msg.id, {
            text: "unhandled error",
          });
      }
      return;
    }
    if (/deleteprice \d/.test(data)) {
      let id = data.replace(/[A-z\s]/gi, "");
      let response = undefined;
      try {
        const tablename = await getTableName(msg.from.id);
        await conn.query(`DELETE FROM ${tablename} WHERE id = ${parseInt(id)}`);
      } catch (e) {
        response = e;
      }
      await bot.editMessageText(
        response
          ? "Ошибка!\n" +
              response.toString() +
              "\nПожалуйста, попробуйте еще раз."
          : "Прайс с ID: " + id + " был успешно удален из базы данных.",
        {
          chat_id: chatId,
          message_id: msg.message.message_id,
          ...goBackOption,
        }
      );
      await bot.answerCallbackQuery(msg.id, {
        text: "saved",
      });
      return;
    }
  });
};

try {
  start();
} catch (e) {
  console.log(e);
}
