// LICENSE : MIT
"use strict";
process.env.DEBUG = true;
try {
    var config = require('../../project.json').environment;
    for (var key in config) {
        process.env[key] = config[key]
    }
} catch (err) {
    // ignore
}
const fn = require("./index").handle;
fn({}, {
    success: function () {
        console.log("=Finish!");
    },
    fail: function (error) {
        console.error(error);
    }
});