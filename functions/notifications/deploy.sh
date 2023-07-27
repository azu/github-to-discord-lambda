#!/usr/bin/env bash

function_name="github-to-twitter"
# Update function code
aws lambda update-function-configuration  --function-name "${function_name}" --environment Variables={`cat .env | tr -s "\n" | tr '\n' ',' | sed s/,$//`} --runtime "nodejs18.x" | cat
echo "Updated ${function_name} environment variables"
# zip quit
zip -q -r deploy.zip . -x "*.git*" -x "*.env*" -x "*.DS_Store*" -x "*deploy.sh*" -x "*README.md*" -x "*package-lock.json*" -x "*package.json*" -x "*node_modules*" -x "*functions*" -x "*src*" -x "*tests*" -x "*coverage*" -x "*serverless*" -x "*webpack.config.js*" -x "*webpack.config.prod.js*" -x "*webpack.config.dev.js*" -x "*webpack.config.base.js*" -x "*webpack.config.test.js*" -x "*webpack.config.server.js*" -x "*webpack.config.client.js*" -x "*webpack.config.vendor.js*" -x "*webpack.config.vendor.prod.js*" -x "*webpack.config.vendor.dev.js*" -x "*webpack.config.vendor.base.js*" -x "*webpack.config.vendor.test.js*" -x "*webpack.config.vendor.server.js*" -x "*webpack.config.vendor.client.js*" -x "*webpack.config.vendor.dll.js*" -x "*webpack.config.vendor.dll.prod.js*" -x "*webpack.config.vendor.dll.dev.js*" -x "*webpack.config.vendor.dll.base.js*" -x "*webpack.config.vendor.dll.test.js*" -x "*webpack.config.vendor.dll.server.js*" -x "*webpack.config.vendor.dll.client.js*"
echo "Zipped ${function_name}"

aws lambda update-function-code --function-name "${function_name}" --zip-file fileb://deploy.zip | cat

echo "Deployed ${function_name}"
