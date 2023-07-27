// LICENSE : MIT
"use strict";
const fs = require("fs");
const dynamodb = require("./aws/dynamodb");
console.log("Create Table");
var updateItem = function (error) {
    console.log(error);
    console.log("========================");
    console.log("Create New Item to Table");
    return dynamodb.updateItem(Date.now());
};
dynamodb.createTable()
    .then(updateItem, updateItem)
    .catch(function (error) {
        console.error(error);
    });

// create .env
fs.writeFileSync(".env", `
GITHUB_USER_NAME=you
GITHUB_TOKEN=ghp...
G2T_ENABLE_PRIVATE_REPOSITORY=false
DISCORD_WEBHOOK=https://...
POST_BODY_LENGTH=200
`, "utf-8");
