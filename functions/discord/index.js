const Octokit = require("@octokit/rest");
const parseGithubEvent = require("parse-github-event");
const { parseEventTitle, parseEventBody } = require("./github/parse-event-body");
const dynamodb = require("./aws/dynamodb");
const moment = require("moment");
const fetch = require("node-fetch")
const removeMd = require('remove-markdown');
const util = require('util');
const isDEBUG = !!process.env.DEBUG;
const ENABLE_PRIVATE_REPOSITORY = String(process.env.G2T_ENABLE_PRIVATE_REPOSITORY) === "true";
console.log("Debug mode: " + isDEBUG);
console.log("ENABLE_PRIVATE_REPOSITORY: " + ENABLE_PRIVATE_REPOSITORY);


const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});


function postToDiscord(message) {
    if (isDEBUG) {
        return Promise.resolve();
    }
    return fetch(process.env.DISCORD_WEBHOOK, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
    }).then(res => {
        return res.text();
    });
}

/**
 * Filter function for event response
 * @param event
 */
function privateEventFilter(event) {
    // if G2T_ENABLE_PRIVATE_REPOSITORY=true, no filter event.
    if (ENABLE_PRIVATE_REPOSITORY) {
        return;
    }
    // Remove private event
    if (event && event.public === false) {
        return false;
    }
    return true;
}

function getEvents(lastDate, eTag) {
    const filterTypes = [
        "WatchEvent",
        "FollowEvent",
        "IssueCommentEvent",
        "PullRequestEvent",
        "PullRequestReviewCommentEvent",
        "IssuesEvent",
        "FollowEvent",
        "PublicEvent",
        "GistEvent"
    ];
    const userName = process.env.GITHUB_USER_NAME;
    return octokit.activity.listReceivedEventsForUser({
        headers: eTag
            ? {
                "If-None-Match": eTag,
            }
            : {},
        username: userName
    }).then(response => {
        return {
            response: response.data,
            eTag: response.headers.etag
        };
    }).catch(errorResponse => {
        // Handle 304 modified as no contents response
        // https://developer.github.com/v3/activity/events/
        if (errorResponse.status === 304) {
            console.log("getEvents: response.status: 304");
            return {
                response: [],
                eTag: errorResponse.headers.etag
            }
        }
        return Promise.reject(errorResponse);
    }).then(function ({ response, eTag }) {
        console.log("pre-filter GET /received_events: ", response.length);
        const items = response
            .filter(privateEventFilter)
            .filter(function (event) {
                return moment(event["created_at"]).diff(lastDate) > 0;
            })
            .filter(function (event) {
                return filterTypes.indexOf(event.type) !== -1;
            })
            .map((event) => {
                const description = buildEvent(event);
                if (!description) {
                    console.log("This event can not build" + util.inspect(event, false, null));
                }
                return description
            })
            .filter(event => {
                return !!event;
            });
        return {
            items,
            eTag
        };
    }).then(({ items, eTag }) => {
        console.log("GET /received_events: ", items.length);
        return {
            items,
            eTag
        }
    });
}

function buildEvent(event) {
    const emojiMap = {
        "ForkEvent": "\u{1F374}",
        "ForkApplyEvent": "\u{1F374}",
        "WatchEvent": "\u{231A}",
        "PullRequestEvent": "\u{1F4DD}",
        "IssuesEvent": "\u{1F6A7}",
        "CommitCommentEvent": "\u{1F4DD}",
        "PullRequestReviewCommentEvent": "\u{1F4DD}",
        "IssueCommentEvent": "\u{1F4DD}",
        "Other": ""
    };
    const getEmoji = function (event) {
        return emojiMap[event.type] || emojiMap.Other;
    };
    const parsedEvent = parseGithubEvent.parse(event);
    if (!parsedEvent) {
        return;
    }
    return {
        "_id": event.id,// GitHub global event id
        "type": "event",
        "date": event.created_at,
        "user_name": event.actor.login,
        "avatar_url": event.actor.avatar_url,
        "repo_name": event.repo.name,
        "title": "[" + event.repo.name + "] " + parseEventTitle(event),
        "html_url": parsedEvent.html_url,
        "body": removeMd(parseEventBody(event) || ""),
        "emoji": getEmoji(event)
    };
}

function getLatestNotification(lastDate) {
    return octokit.activity.listNotifications({
        since: lastDate.toISOString()
    }).then(function (response) {
        return response.data;
    }).then(function (responses) {
        console.log("GET /notifications:", responses.length);
        return responses
            .filter(privateNotificationFilter)
            .map(buildNotification);
    });
}

function normalizeResponseAPIURL(url) {
    return url.replace(/^https:\/\/api\.github\.com\/repos\/(.*?)\/(commits|pulls|issues)\/(.*?)/, function (all, repo, type, number) {
        return "https://github.com/" + repo + "/" + type.replace("pulls", "pull") + "/" + number
    })
}


/**
 * Filter function for notification response
 * @param notification
 */
function privateNotificationFilter(notification) {
    // if G2T_ENABLE_PRIVATE_REPOSITORY=true, no filter notification.
    if (ENABLE_PRIVATE_REPOSITORY) {
        return;
    }
    // Remove private repository
    if (notification && notification.repository && notification.repository.private) {
        return false;
    }
    return true;
}

function buildNotification(notification) {
    const emojiMap = {
        "PullRequest": "\u{1F4DD}",
        "Issue": "\u{1F6A7}",
        "Other": "\u{26A0}"
    };
    const getEmoji = function (notification) {
        return emojiMap[notification.subject.type] || emojiMap.Other;
    };
    const commentIdPattern = /^https:.+\/comments\/(\d+)$/;
    const htmlUrl = (() => {
        if (notification.subject.url) {
            return normalizeResponseAPIURL(notification.subject.url);
        }
        if (notification.subject.type === "Discussion") {
            return `${notification.repository.html_url}/discussions/`;
        }
        return ""
    })();
    if (!htmlUrl) {
        console.log("No HTML url on notification", util.inspect(notification));
    }
    return {
        "_id": notification.id,// github global event id
        "type": "notification",
        "date": notification.updated_at,
        "user_name": notification.repository.owner.login,
        "avatar_url": notification.repository.owner.avatar_url,
        "repo_name": notification.repository.name,
        "title": "[" + notification.repository.full_name + "] " + notification.subject.title,
        "html_url": htmlUrl,
        "request_url": notification.subject.latest_comment_url,
        //     latest_comment_url: 'https://api.github.com/repos/microsoft/TypeScript/issues/comments/543489328',
        "comment_id": commentIdPattern.test(notification.subject.latest_comment_url)
            ? notification.subject.latest_comment_url.replace(commentIdPattern, "$1")
            : undefined,
        "body": htmlUrl,
        "emoji": getEmoji(notification),
        "timestamp": moment(notification.updated_at).toISOString()
    };
}

function formatMessage(response) {
    // e.g.
    // https://github.com/microsoft/TypeScript/issues/34550#issuecomment-543486701
    const commentHash = response.comment_id
        ? `#issuecomment-${response.comment_id}`
        : "";
    const title = response.emoji + response.title;
    const url = response.html_url + commentHash;
    const userLimit = Number(process.env.POST_BODY_LENGTH);
    const postBodyLimit = Number.isNaN(userLimit) ? 10000 : userLimit;
    return {
        "username": response.user_name,
        "avatar_url": response.avatar_url,
        // "content": `${title}\n${response.body}\n${url}`,
        "embeds": [
            {
                "title": title,
                "description": response.body.length > postBodyLimit ? response.body.slice(0, postBodyLimit) + "…" : response.body,
                "url": url,
                // "timestamp": response.timestamp,
            }
        ]
    };
}

/**
 * Timeline
 *
 * Start                                                       End
 * |----x-----------------------y-------------------------z-----|
 *      ^                       |                         |
 *      getLastUpdatedTime      ^                         |
 *                     getEvents&getNotifications         ^
 *                                                SaveLastUpdateTime
 *
 * Note: Missing items that is updated betweeen x ~ z
 */
exports.handle = async function (event, context, callback) {
    console.log("will get dynamodb");
    const { lastDate, eTag } = await dynamodb.getItem().then(({ lastExecutedTime, eventETag }) => {
        console.log("did get dynamodb:" + lastExecutedTime, "eTags", eventETag);
        const lastDate = lastExecutedTime > 0 ? moment.utc(lastExecutedTime).toDate() : moment.utc().toDate();
        // if debug, use 1970s
        const lastDateInUse = isDEBUG ? moment.utc().subtract(10, 'minutes').toDate() : lastDate;
        console.log("get events and notifications since " + moment(lastDateInUse).format("YYYY-MM-DD HH:mm:ss"));
        return {
            lastDate: lastDateInUse,
            eTag: isDEBUG ? "" : eventETag
        };
    });
    return Promise.all([
        getEvents(lastDate, eTag),
        getLatestNotification(lastDate)
    ]).then(function ([{ items, eTag }, notifications]) {
        // update lastDate
        // pass response to next then
        if (isDEBUG && process.env.forceUpdateDynamoDb !== "true") {
            console.log("DEBUG MODE: did not update dynamodb, because it is debug mode");
            return [items, notifications];
        }
        const currentTime = Date.now();
        console.log("will update dynamodb:" + currentTime);
        return dynamodb.updateItem(currentTime, eTag).then(function () {
            console.log("did update dynamodb:" + currentTime + ", eTag:" + eTag);
            return [items, notifications];
        });
    }).then(([events, notifications]) => {
        const eventMessages = events.map(event => formatMessage(event));
        const notificationMessages = notifications.map(notification => formatMessage(notification));
        const responses = eventMessages.concat(notificationMessages);
        console.log("will post to discord:" + responses.length);
        const promises = responses.map(message => {
            return postToDiscord(message).then(() => {
                console.log("Post Success:" + JSON.stringify(message));
            }).catch(error => {
                console.log("Post Error:" + message);
                return Promise.reject(error);
            })
        });
        return Promise.all(promises).then(function () {
            console.log("Success: " + promises.length + "posts");
        });
    }).then(function () {
        callback();
    }).catch(function (error) {
        console.log("Failure: " + util.inspect(error, false, null));
        callback(error);
    });
};
