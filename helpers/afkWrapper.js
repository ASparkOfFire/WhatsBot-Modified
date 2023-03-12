//jshint esversion:11
const fs = require("fs");
const path = require("path");
const database = require("../db");
const calcTime = require("./timediff");

async function read() {
  let { conn, coll } = await database("afk");
  try {
    let data = await coll.findOne({ afk: true });
    if (data) {
      fs.writeFileSync(
        path.join(__dirname, `../cache/AFK.json`),
        JSON.stringify(data)
      );
    }
    return data ? data : null;
  } catch (error) {
    return null;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

async function updateChatList(chat) {
  const { conn, coll } = await database("afk");
  try {
    let data = await getAFKData();
    let chatlist = new Map(data?.chats);
    chatlist.set(chat, Date.now());
    data.chats = Array.from(chatlist);
    fs.writeFileSync(
      path.join(__dirname, `../cache/AFK.json`),
      JSON.stringify(data)
    );
    await coll.updateOne({ afk: true }, { $set: { chats: data.chats } });
    return true;
  } catch (error) {
    return false;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/* Userge inspired AFK message */
function getAfkString() {
  const afkStrings = [
    "Hello! Thank you for reaching out.\nI am currently away from my device,\nbut I will respond as soon as I can.\nThank you for your understanding!",
  ];

  return afkStrings[Math.floor(Math.random() * afkStrings.length)];
}

async function getAFKData() {
  let data;
  try {
    data = JSON.parse(
      fs.readFileSync(path.join(__dirname, `../cache/AFK.json`))
    );
  } catch (error) {
    data = await read();
  }
  return data;
}

async function setAfk(reason) {
  let data = await getAFKData();

  if (data) return data;

  const { conn, coll } = await database("afk");
  const time = Math.floor(Date.now());
  data = { afk: true, reason, time, chats: [] };

  try {
    await coll.insertOne(data);
    fs.writeFileSync(
      path.join(__dirname, `../cache/AFK.json`),
      JSON.stringify(data)
    );
    return { set: true };
  } catch (error) {
    return { set: false };
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

async function setOnline() {
  let data = await getAFKData();

  if (data) {
    const { conn, coll } = await database("afk");
    let timediff = calcTime(data.time, Date.now());
    try {
      fs.unlinkSync(path.join(__dirname, `../cache/AFK.json`));
      console.log(`Deleting afk data`);
    } catch (nofile) {}

    try {
      await coll.deleteOne({ afk: true });
      return {
        chats: data.chats,
        timediff,
      };
    } catch (error) {
      return null;
    } finally {
      if (conn) {
        await conn.close();
      }
    }
  } else {
    return null;
  }
}

async function afkHandler(sender) {
  let data = await getAFKData();

  if (data) {
    let timediff = calcTime(data.time, Date.now());
    let chatlist = new Map(data?.chats);
    let [, , min] = calcTime(chatlist.get(sender) || Date.now(), Date.now());
    if (!chatlist.has(sender) || min >= 15) {
      await updateChatList(sender);
      return {
        notify: true,
        reason: data.reason,
        timediff,
        msg: getAfkString(),
      };
    }
    return { notify: false };
  } else {
    return null;
  }
}

module.exports = {
  setAfk,
  setOnline,
  getAFKData,
  afkHandler,
};
