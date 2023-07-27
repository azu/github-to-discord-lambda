// LICENSE : MIT
"use strict";
process.env.DEBUG = true;
require("dotenv").config();
process.env["forceUpdateDynamoDb"] = true;
const fn = require("./index").handle;
fn({}, {}, (error, response) => {
    if (error) {
        console.error(error);
    } else {
        console.log(response);
    }
});
