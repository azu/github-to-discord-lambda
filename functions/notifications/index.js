const TweetTruncator = require("tweet-truncator").TweetTruncator;
const Octokit = require("@octokit/rest");
const parseGithubEvent = require("parse-github-event");
const parseEventBody = require("./github/parse-event-body");
const Twitter = require("twitter");
const dynamodb = require("./aws/dynamodb");
const moment = require("moment");
const removeMd = require('remove-markdown');
const util = require('util');
const isDEBUG = !!process.env.DEBUG;
const IS_JOIN_POST = String(process.env.JOIN_POST_MODE) === "true";
const ENABLE_PRIVATE_REPOSITORY = String(process.env.G2T_ENABLE_PRIVATE_REPOSITORY) === "true";
console.log("Debug mode: " + isDEBUG);
console.log("IS_JOIN_POST: " + IS_JOIN_POST);
console.log("ENABLE_PRIVATE_REPOSITORY: " + ENABLE_PRIVATE_REPOSITORY);


const DYNAMODB_LAST_UPDATED_KEY = "github-to-twitter-lambda";
const DYNAMODB_EVENTS_ETAG = "github-to-twitter-lambda-etag";
const twitter = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

function flatten(array) {
    return Array.prototype.concat.apply([], array);
}

// [1,2,3,4]
// => [1,2], [3, 4]
function* twoPairIterator(iterable) {
    const iterator = iterable[Symbol.iterator]();
    let current = iterator.next();
    let next = iterator.next();
    while (!current.done) {
        yield [current.value, next.value];
        current = iterator.next();
        next = iterator.next();
    }
}

function postToTwitter(message) {
    if (isDEBUG) {
        return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
        twitter.post('statuses/update', { status: message }, function (error, tweet, response) {
            if (error) {
                reject(error);
            }
            resolve();
        });
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
        // "IssueCommentEvent",
        // "PullRequestEvent",
        // "PullRequestReviewCommentEvent",
        // "IssuesEvent",
        "FollowEvent",
        "PublicEvent",
        "GistEvent"
    ];
    const userName = process.env.GITHUB_USER_NAME;
    return octokit.activity.listReceivedEventsForUser({
        headers: {
            "If-None-Match": eTag,
        },
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
        let items = response
            .filter(privateEventFilter)
            .filter(function (event) {
                return moment.utc(event["created_at"]).diff(lastDate) > 0;
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
    const eventDescription = parseGithubEvent.compile(parsedEvent);
    return {
        "_id": event.id,// GitHub global event id
        "type": "event",
        "date": event.created_at,
        "user_name": event.actor.login,
        "avatar_url": event.actor.avatar_url,
        "repo_name": event.repo.name,
        "title": "[" + event.repo.name + "] " + eventDescription,
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
    return {
        "_id": notification.id,// github global event id
        "type": "notification",
        "date": notification.updated_at,
        "user_name": notification.repository.owner.login,
        "avatar_url": notification.repository.owner.avatar_url,
        "repo_name": notification.repository.name,
        "title": "[" + notification.repository.full_name + "]",
        "html_url": normalizeResponseAPIURL(notification.subject.url),
        "request_url": notification.subject.latest_comment_url,
        //     latest_comment_url: 'https://api.github.com/repos/microsoft/TypeScript/issues/comments/543489328',
        "comment_id": commentIdPattern.test(notification.subject.latest_comment_url)
            ? notification.subject.latest_comment_url.replace(commentIdPattern, "$1")
            : undefined,
        "body": notification.subject.title,
        "emoji": getEmoji(notification),
        "timestamp": moment(notification.updated_at).format("HH:mm:ss")
    };
}

function formatMessage(response) {
    // e.g.
    // https://github.com/microsoft/TypeScript/issues/34550#issuecomment-543486701
    const commentHash = response.comment_id
        ? `#issuecomment-${response.comment_id}`
        : "";
    var contents = {
        title: response.emoji + response.title,
        url: response.html_url + commentHash,
        desc: response.body,
        quote: "",
        tags: []
    };
    var options = {
        defaultPrefix: "",
        template: '%title%\n%desc%\n%url%\n%quote%',
        truncatedOrder: [
            "tags",
            "quote",
            "desc",
            "title",
            "url"
        ],
        maxLength: 140 // default is 140
    };
    var truncator = new TweetTruncator(options);
    var status = truncator.joinContents(contents);
    var over = truncator.getTweetLength(status) - 140;
    if (over > 0) {
        return truncator.truncateStatus(contents, over);
    }
    return status;
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
            eTag: eventETag
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
        const messages = events.map(event => {
            return formatMessage(event);
        });
        const notificationMessages = IS_JOIN_POST
            ? Array.from(twoPairIterator(notifications)).map(pairItem => {
                return formatMessage(pairItem[0]) + (pairItem[1]
                    ? "\n\n" + formatMessage(pairItem[1])
                    : "");
            })
            : messages;
        const responses = messages.concat(notificationMessages);
        console.log("will post to twitter:" + responses.length);
        const promises = notificationMessages.map(message => {
            return postToTwitter(message).then(() => {
                console.log("Post Success:" + message);
            }).catch(error => {
                console.log("Post Error:" + message);
                console.log("=> Error response:" + JSON.stringify(response));
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
