// LICENSE : MIT
"use strict";
const AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';
const endpoint = new AWS.Endpoint('s3.amazonaws.com');
const lastExecutionFile = "github-to-twitter-lambda.json";
const s3bucket = new AWS.S3({
    endpoint: endpoint
});
function uploadS3(object) {
    return new Promise(function (resolve, reject) {
        s3bucket.createBucket(function () {
            s3bucket.upload({Bucket: object.Bucket, Key: object.Key, Body: object.Body}, function (err, data) {
                if (err) {
                    reject(err)
                } else {
                    resolve();
                }
            });
        });
    });
}
function getAsync(bucketName) {
    return new Promise(function (resolve, reject) {
        s3bucket.getObject({
            Bucket: bucketName,
            Key: lastExecutionFile
        }, function (error, data) {
            if (error) {
                return resolve();
            }
            if (data) {
                const savedData = JSON.parse(data.Body.toString());
                resolve(savedData.lastExecutionTime);
            }
        });
    });
}
function putAsync(bucketName) {
    const lockData = {
        lastExecutionTime: Date.now()
    };

    const saveData = {
        Bucket: bucketName,
        Key: lastExecutionFile,
        Body: JSON.stringify(lockData)
    };
    return new Promise(function (resolve, reject) {
        s3bucket.putObject(saveData, function (error, data) {
            if (error) {
                return reject(error);
            }
            resolve(data);
        });
    }).catch(function () {
        return uploadS3(saveData);
    });
}

module.exports = {
    getAsync: getAsync,
    putAsync: putAsync
};