// LICENSE : MIT
"use strict";
process.env.DEBUG = true;
process.env.JOIN_POST_MODE = true;
require("dotenv").config();
const fn = require("./index").handle;
fn({}, {}, (error, response) => {
    if (error) {
        console.error(error);
    } else {
        console.log(response);
    }
});
