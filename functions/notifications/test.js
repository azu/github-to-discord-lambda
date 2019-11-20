// LICENSE : MIT
"use strict";
process.env.DEBUG = true;
process.env.JOIN_POST_MODE = true;
try {
    var config = require('../../project.json').environment;
    for (var key in config) {
        process.env[key] = config[key];
    }
} catch (err) {
    // ignore
}
const fn = require("./index").handle;
fn({}, {}, (error, response) => {
    if (error) {
        console.error(error);
    } else {
        console.log(response);
    }
});
