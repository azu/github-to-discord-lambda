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
function createItem(lastExecutedTime) {
    return new Promise(function (resolve, reject) {
        const docClient = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: tableName,
            Item: {
                "id": itemIdentifier,
                "lastExecutedTime": lastExecutedTime
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

function updateItem(lastExecutedTime) {
    return new Promise(function (resolve, reject) {
        const docClient = new AWS.DynamoDB.DocumentClient();
        const params = {
            TableName: tableName,
            Key: {
                "id": itemIdentifier
            },
            "UpdateExpression": "set #lastExecutedTime = :val1",
            "ExpressionAttributeValues": {
                ":val1": lastExecutedTime
            },
            "ExpressionAttributeNames": {
                "#lastExecutedTime": "lastExecutedTime"
            }
        };
        docClient.update(params, function (err, data) {
            if (err) {
                return reject(err);
            } else {
                console.log("Update dynamodb", data);
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
                console.log("dynamodb getItem", data);
                return resolve(data["Item"]["lastExecutedTime"]);
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


