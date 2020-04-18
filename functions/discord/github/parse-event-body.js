// LICENSE : MIT
"use strict";

// https://developer.github.com/v3/repos/commits/
const parseGithubEvent = require("parse-github-event");

function compileFormPushEvent(event) {
    var commits = event.payload.commits;
    return commits.map(function (commit) {
        return "- " + commit.message;
    }).join("\n");
}

function parseEventTitle(event) {
    if (event.payload.issue) {
        return event.payload.issue.title;
    } else if (event.payload.pull_request) {
        return event.payload.pull_request.title;
    } else {
        const parsedEvent = parseGithubEvent.parse(event);
        return parseGithubEvent.compile(parsedEvent);
    }
}

function parseEventBody(event) {
    var payload = event.payload;
    if (payload.comment) {
        return payload.comment.body;
    } else if (payload.issue) {
        return payload.issue.body;
    } else if (event.type === "PushEvent") {
        return compileFormPushEvent(event);
    } else if (payload.pull_request) {
        return payload.pull_request.body;
    }
    return "";
}

module.exports.parseEventBody = parseEventBody;
module.exports.parseEventTitle = parseEventTitle;
