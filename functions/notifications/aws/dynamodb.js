// LICENSE : MIT
"use strict";
const AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.REGION || 'us-east-1'
});
const dynamodb = new AWS.DynamoDB({
    region: process.env.REGION || 'us-east-1'
});
const tableName = "github-to-twitter-lambda";
const itemIdentifier = 421; // id
function createTable() {
    return new Promise(function (resolve, reject) {
        const params = {
            TableName: tableName,
            KeySchema: [
                {AttributeName: "id", KeyType: "HASH"}
            ],
            AttributeDefinitions: [
                {AttributeName: "id", AttributeType: "N"}
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        };

        dynamodb.createTable(params, function (err, data) {
            if (err) {
                return reject(err);
            } else {
                return resolve(data);
            }
        });
    });
}
function createItem(lastExecutedTime, eventETag) {
    return new Promise(function (resolve, reject) {
        const docClient = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: tableName,
            Item: {
                "id": itemIdentifier,
                "lastExecutedTime": lastExecutedTime,
                "eventETag": eventETag
            }
        };
        docClient.putItem(params, function (err, data) {
            if (err) {
                return reject(err);
            } else {
                return resolve(data);
            }
        });
    });
}

function updateItem(lastExecutedTime, eventETag) {
    return new Promise(function (resolve, reject) {
        const docClient = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: tableName,
            Key: {
                "id": itemIdentifier
            },
            "UpdateExpression": "set #lastExecutedTime = :val1, #eventETag = :val2",
            "ExpressionAttributeValues": {
                ":val1": lastExecutedTime,
                ":val2": eventETag
            },
            "ExpressionAttributeNames": {
                "#lastExecutedTime": "lastExecutedTime",
                "#eventETag": "eventETag"
            }
        };
        docClient.update(params, function (err, data) {
            if (err) {
                return reject(err);
            } else {
                console.log("Update dynamodb", lastExecutedTime, "eTag", eventETag);
                return resolve(data);
            }
        });
    });
}


function getItem() {
    return new Promise(function (resolve, reject) {
        const docClient = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: tableName,
            Key: {
                "id": itemIdentifier
            }
        };
        docClient.get(params, function (err, data) {
            if (err) {
                return reject(err);
            } else {
                console.log("dynamodb getItem", data["Item"]);
                return resolve(data["Item"]);
            }
        });
    })
}

module.exports = {
    createTable: createTable,
    createItem: createItem,
    updateItem: updateItem,
    getItem: getItem
};


