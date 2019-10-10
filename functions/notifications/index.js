const TweetTruncator = require("tweet-truncator").TweetTruncator;
const GitHub = require("github-api");
const parseGithubEvent = require("parse-github-event");
const parseEventBody = require("./github/parse-event-body");
const Twitter = require("twitter");
const dynamodb = require("./aws/dynamodb");
const moment = require("moment");
const removeMd = require('remove-markdown');
const isDEBUG = !!process.env.DEBUG;
const ENABLE_PRIVATE_REPOSITORY = process.env.G2T_ENABLE_PRIVATE_REPOSITORY === "true";
console.log("Debug mode: " + isDEBUG);
console.log("ENABLE_PRIVATE_REPOSITORY: " + ENABLE_PRIVATE_REPOSITORY);
const twitter = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});
const gitHubAPI = new GitHub({
    token: process.env.GITHUB_TOKEN
});

function flatten(array) {
    return Array.prototype.concat.apply([], array);
}

function postToTwitter(message) {
    if (isDEBUG) {
        return Promise.resolve();
    }
    return new Promise(function(resolve, reject) {
        twitter.post('statuses/update', { status: message }, function(error, tweet, response) {
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
    if (ENABLE_PRIVATE_REPOSITORY) {return;}
    // Remove private event
    if (event && event.public === false) {
        return false;
    }
    return true;
}

function getEvents(lastDate) {
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
    const me = gitHubAPI.getUser();
    const userName = process.env.GITHUB_USER_NAME;
    return me._request('GET', '/users/' + userName + '/received_events')
        .then(function(response) {
            return response.data;
        }).then(function(response) {
            return response
                .filter(privateEventFilter)
                .filter(function(event) {
                    return moment(event["created_at"]).diff(lastDate) > 0;
                })
                .filter(function(event) {
                    return filterTypes.indexOf(event.type) !== -1;
                })
                .map(buildEvent);
        }).then(function(response) {
            console.log("GET /received_events: ", response.length);
            return response
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
    const getEmoji = function(event) {
        return emojiMap[event.type] || emojiMap.Other;
    };
    const parsedEvent = parseGithubEvent.parse(event);
    const eventDescription = parseGithubEvent.compile(event);
    return {
        "_id": event.id,// GitHub global event id
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
    const me = gitHubAPI.getUser();
    return me.listNotifications({
        since: lastDate.toISOString()
    }).then(function(response) {
        return response.data;
    }).then(function(responses) {
        console.log("GET /notifications:", responses.length);
        return responses
            .filter(privateNotificationFilter)
            .map(buildNotification);
    });
}

function normalizeResponseAPIURL(url) {
    return url.replace(/^https:\/\/api\.github\.com\/repos\/(.*?)\/(commits|pulls|issues)\/(.*?)/, function(all, repo, type, number) {
        return "https://github.com/" + repo + "/" + type.replace("pulls", "pull") + "/" + number
    })
}


/**
 * Filter function for notification response
 * @param notification
 */
function privateNotificationFilter(notification) {
    // if G2T_ENABLE_PRIVATE_REPOSITORY=true, no filter notification.
    if (ENABLE_PRIVATE_REPOSITORY) {return;}
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
    const getEmoji = function(notification) {
        return emojiMap[notification.subject.type] || emojiMap.Other;
    };
    return {
        "_id": notification.id,// github global event id
        "date": notification.updated_at,
        "user_name": notification.repository.owner.login,
        "avatar_url": notification.repository.owner.avatar_url,
        "repo_name": notification.repository.name,
        "title": "[" + notification.repository.full_name + "]",
        "html_url": normalizeResponseAPIURL(notification.subject.url),
        "request_url": notification.subject.latest_comment_url,
        "body": notification.subject.title,
        "emoji": getEmoji(notification)
    };
}

function formatMessage(response) {
    var contents = {
        title: response.emoji + response.title,
        url: response.html_url,
        desc: response.body,
        quote: "",
        tags: []
    };
    var options = {
        defaultPrefix: "",
        template: '%title%\n%desc%\n%url%',
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

exports.handle = function(event, context, callback) {
    const bucketName = "github-to-twitter-lambda";
    console.log("will get dynamodb");
    dynamodb.getItem(bucketName).then(function(response) {
        // pass response to next then
        if (isDEBUG && process.env.forceUpdateDynamoDb !== "true") {
            console.log("DEBUG MODE: did not update dynamodb, because it is debug mode");
            return response;
        }
        const currentTIme = Date.now();
        console.log("will update dynamodb:" + currentTIme);
        return dynamodb.updateItem(currentTIme).then(function() {
            console.log("did update dynamodb");
            return response;
        });
    }).then(function(lastTime) {
        console.log("did get dynamodb:" + lastTime);
        const lastDate = lastTime > 0 ? moment.utc(lastTime).toDate() : moment.utc().toDate();
        // if debug, use 1970s
        const lastDateInUse = isDEBUG ? moment.utc().subtract(5, 'minutes').toDate() : lastDate;
        console.log("get events and notifications since " + moment(lastDateInUse).format("YYYY-MM-DD HH:mm:ss"));
        return Promise.all([
            getEvents(lastDateInUse), getLatestNotification(lastDateInUse)
        ]);
    }).then(function(allResponse) {
        const responses = flatten(allResponse);
        console.log("will post to twitter:" + responses.length);
        const promises = responses.map(function(response) {
            const message = formatMessage(response);
            console.log("-----\n" + message + "\n-----");
            return postToTwitter(message);
        });
        return Promise.all(promises).then(function() {
            console.log("Success: " + promises.length + "posts");
        });
    }).then(function() {
        callback();
    }).catch(function(error) {
        console.log(error.message, error.stack);
        callback(error);
    });
};
