import { conn } from "./index.js";
import bcrypt from "bcryptjs";

const oneDay = 1000 * 60 * 60 * 24;
const authLifeTime = 1 * oneDay;

export const registration = async (password = "lolapopa") => {
  const hashedpassword = await bcrypt.hash(password, 5);
  console.log(hashedpassword);
};

export const checkForAuth = async (id) => {
  try {
    const date = (
      await conn.query(
        "SELECT lastlogindate FROM users WHERE telegram_id = " + id
      )
    )[0];
    if (date.length === 0) {
      return false;
    }
    const { lastlogindate } = date[0];
    return Date.now() - lastlogindate < authLifeTime;
  } catch (e) {
    return e.sqlMessage ? e.sqlMessage : "Unhandled Error";
  }
};

export const login = async (id, password) => {
  try {
    const data = (
      await conn.query(`SELECT * FROM users WHERE telegram_id = ${id}`)
    )[0];
    if (data.length === 0) {
      return "У вас нет учетной записи. Пожалуйста, зарегистрируйтесь.";
    }
    const user = data[0];
    const isPassValid = bcrypt.compareSync(password, user.password);
    if (!isPassValid) {
      return "Пароль введен неверно, попробуйте еще раз.";
    }
    const date = new Date(Date.now());
    await conn.query(`UPDATE users SET ? WHERE telegram_id = ${id}`, {
      lastlogindate: date,
    });
    return (
      "Вы успешно авторизоны. Добро пожаловать, " +
      user.name +
      "!\nНажмите /menu для просмотра Главного меню."
    );
  } catch (e) {
    console.log(e);
    return e.sqlMessage ? e.sqlMessage : "Unhandled Error";
  }
};

export const logout = async (id) => {
  try {
    const date = new Date(Date.now() - authLifeTime * 3);
    await conn.query(`UPDATE users SET ? WHERE telegram_id = ${id}`, {
      lastlogindate: date,
    });
    return "Вы вышли из аккаунта и больше не авторизованы.";
  } catch (e) {
    console.log(e);
    return e.sqlMessage ? e.sqlMessage : "Unhandled Error";
  }
};
export const getTableName = async (id) => {
  try {
    const { tablename } = (
      await conn.query(`SELECT tablename FROM users WHERE telegram_id = ${id}`)
    )[0][0];
    return tablename;
  } catch (e) {
    console.log(e);
    return "0";
  }
};
