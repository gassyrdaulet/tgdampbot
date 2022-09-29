import { conn } from "./index.js";

export const searchPricesById = async (id, tablename) => {
  const result = (
    await conn.query(`SELECT * FROM ${tablename} WHERE id = ${parseInt(id)}`)
  )[0];
  if (result.length === 0) {
    return `По запросу '${id}'  ничего не найдено.`;
  }
  let finalmsg = "";
  for (let itr = 0; itr < 1; itr++) {
    if (result[itr]) {
      let availabilities = "";
      if (result[itr].availability) {
        availabilities =
          result[itr].availability.$.available === "yes" ? "PP1(+)" : "PP1(-)";
      }
      for (let i = 2; i <= 5; i++) {
        if (result[itr]["availability" + i]) {
          if (result[itr]["availability" + i].$.available === "yes") {
            availabilities += `PP${i}(+)`;
          } else {
            availabilities += `PP${i}(-)`;
          }
        }
      }
      finalmsg += `🔸 <a href="${result[itr].url}">${result[itr].brand} ${result[itr].model}</a> - ${result[itr].suk} - MIN: ${result[itr].minprice}тг - NOW: ${result[itr].actualprice}тг - MAX: ${result[itr].maxprice}тг - AVL: ${availabilities} - ID: ${result[itr].id}\n\n`;
    }
  }
  return finalmsg;
};

export const searchPrices = async (query, tablename) => {
  const result = (
    await conn.query(
      `SELECT * FROM ${tablename} WHERE (model LIKE '%${query}%' OR suk2 LIKE '%${query}%')`
    )
  )[0];
  if (result.length === 0) {
    return `По запросу '${query}'  ничего не найдено, попробуете еще раз?`;
  }
  let finalmsg = "";
  for (let itr = 0; itr < 10; itr++) {
    if (result[itr]) {
      let availabilities = "";
      if (result[itr].availability) {
        availabilities =
          result[itr].availability.$.available === "yes" ? "PP1(+)" : "PP1(-)";
      }
      for (let i = 2; i <= 5; i++) {
        if (result[itr]["availability" + i]) {
          if (result[itr]["availability" + i].$.available === "yes") {
            availabilities += `PP${i}(+)`;
          } else {
            availabilities += `PP${i}(-)`;
          }
        }
      }
      finalmsg += `${itr + 1}) 🔸 <a href="${result[itr].url}">${
        result[itr].brand
      } ${result[itr].model}</a> - ${result[itr].suk} - MIN: ${
        result[itr].minprice
      }тг - NOW: ${result[itr].actualprice}тг - MAX: ${
        result[itr].maxprice
      }тг - AVL: ${availabilities} - ID: ${result[itr].id}\n\n`;
    } else {
      break;
    }
  }
  finalmsg = `Результаты по запросу '${query}': \n` + finalmsg;
  return finalmsg;
};

export const editPrices = async (field, newvalue, id, tablename) => {
  try {
    if (field === "availabilities") {
      const availabilities = {};
      for (let i = 1; i <= 5; i++) {
        availabilities["availability" + (i === 1 ? "" : i)] = JSON.stringify({
          $: { storeId: "PP" + i, available: "no" },
        });
      }
      newvalue.map((value) => {
        availabilities["availability" + (value + 1 === 1 ? "" : value + 1)] =
          JSON.stringify({
            $: { storeId: "PP" + (value + 1), available: "yes" },
          });
      });
      const result = await conn.query(
        `UPDATE ${tablename} SET ? WHERE id = ${id}`,
        availabilities
      );
      return result;
    }
    const editData = {};
    editData[field] = newvalue;
    const result = await conn.query(
      `UPDATE ${tablename} SET ? WHERE id = ${id}`,
      editData
    );
    if (field === "suk") {
      //url changing
      const url =
        "https://kaspi.kz/shop/p/-" +
        newvalue +
        "/?c=710000000#!/sellers/" +
        newvalue;
      await conn.query(`UPDATE ${tablename} SET ? WHERE id = ${id}`, { url });
    }
    return result;
  } catch (e) {
    console.log(e);
    return e;
  }
};

export const paginatePrices = async (initial, condition, tablename) => {
  const prices = (await conn.query(`SELECT * FROM ${tablename}`))[0];
  let finalmsg = "";
  let count = 0;
  for (let itr = initial; itr < condition; itr++) {
    if (prices[itr]) {
      count++;
      let availabilities = "";
      if (prices[itr].availability) {
        availabilities =
          prices[itr].availability.$.available === "yes" ? "PP1(+)" : "PP1(-)";
      }
      for (let i = 2; i <= 5; i++) {
        if (prices[itr]["availability" + i]) {
          if (prices[itr]["availability" + i].$.available === "yes") {
            availabilities += `PP${i}(+)`;
          } else {
            availabilities += `PP${i}(-)`;
          }
        }
      }
      finalmsg += `${itr + 1}) 🔸 <a href="${prices[itr].url}">${
        prices[itr].brand
      } ${prices[itr].model}</a> - ${prices[itr].suk} - MIN: ${
        prices[itr].minprice
      }тг - NOW: ${prices[itr].actualprice}тг - MAX: ${
        prices[itr].maxprice
      }тг - AVL: ${availabilities} - ID: ${prices[itr].id}\n\n`;
    }
  }
  finalmsg =
    `Список всех прайсов: (${count + initial} из ${prices.length})\n` +
    finalmsg;
  return { finalmsg, total: Math.ceil(prices.length / 10) };
};
