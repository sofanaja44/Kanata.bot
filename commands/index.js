const fs = require("fs");
const path = require("path");

const commands = {};

fs.readdirSync(__dirname)
  .filter(file => file.endsWith(".js") && file !== "index.js")
  .forEach(file => {
    const cmd = require(path.join(__dirname, file));
    if (cmd.name) {
      commands[cmd.name] = cmd;
    }
  });

module.exports = commands;
