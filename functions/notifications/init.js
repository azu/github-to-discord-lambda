// LICENSE : MIT
"use strict";
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