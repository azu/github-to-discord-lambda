const TweetTruncator = require("tweet-truncator").TweetTruncator;
const GitHub = require("github-api");
const Twitter = require("twitter");
const s3 = require("./s3");
const isDEBUG = !!process.env.DEBUG;
console.log("Debug mode: " + isDEBUG);
const twitter = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});
const gitHubAPI = new GitHub({
    token: process.env.GITHUB_TOKEN
});
function postToTwitter(message) {
    if (isDEBUG) {
        return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
        twitter.post('statuses/update', {status: message}, function (error, tweet, response) {
            if (error) {
                reject(error);
            }
            resolve();
        });

    });
}
function getLatestNotification(lastDate) {
    const me = gitHubAPI.getUser();
    return me.listNotifications({
        since: lastDate.toISOString()
    }).then(function (response) {
        return response.data;
    });
}
function normalizeResponseAPIURL(url) {
    return url.replace(/^https:\/\/api\.github\.com\/repos\/(.*?)\/(commits|pulls|issues)\/(.*?)/, function (all, repo, type, number) {
        return "https://github.com/" + repo + "/" + type.replace("pulls", "pull") + "/" + number
    })
}
function buildNotifications(notifications) {
    const emojiMap = {
        "PullRequest": "\u{1F4DD}",
        "Issue": "\u{1F6A7}",
        "Other": "\u{26A0}"
    };
    const getEmoji = function (notification) {
        return emojiMap[notification.subject.type] || emojiMap.Other;
    };
    return notifications.map(function (notification) {
        return {
            "_id": notification.id,// github global event id
            "date": notification.updated_at,
            "user_name": notification.repository.owner.login,
            "avatar_url": notification.repository.owner.avatar_url,
            "repo_name": notification.repository.name,
            "title": notification.repository.full_name,
            "html_url": normalizeResponseAPIURL(notification.subject.url),
            "request_url": notification.subject.latest_comment_url,
            "body": notification.subject.title,
            "emoji": getEmoji(notification)
        };
    });
}

function formatMessage(response) {
    var contents = {
        title: response.emoji + "[" + response.title + "] ",
        url: response.html_url,
        desc: response.body,
        quote: "",
        tags: []
    };
    var options = {
        defaultPrefix: "See:",
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

exports.handle = function (event, context) {
    const bucketName = "github-to-twitter-lambda";
    s3.getAsync(bucketName).then(function (lastTime) {
        const lastDate = lastTime > 0 ? new Date(lastTime) : new Date();
        // if debug, use 1970s
        const lastDateInUse = isDEBUG ? new Date(1970, 0, 1) : lastDate;
        console.log("lastExecutedTime: " + lastDateInUse);
        return getLatestNotification(lastDateInUse).then(function (responses) {
            const promises = buildNotifications(responses).map(function (response) {
                const message = formatMessage(response);
                console.log(message);
                return postToTwitter(message);
            });
            return Promise.all(promises).then(function () {
                console.log("Success: " + promises.length + "posts");
            }, function (error) {
                console.error(error, error.stack);
            });
        });
    }).then(function () {
        if (isDEBUG) {
            return Promise.resolve();
        }
        return s3.putAsync(bucketName);
    }).then(function () {
        context.success();
    }, function (error) {
        context.fail(error);
    })
};
