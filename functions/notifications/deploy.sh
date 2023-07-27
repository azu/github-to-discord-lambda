#!/usr/bin/env bash

function_name="github-to-twitter"
# Update function code
aws lambda update-function-configuration  --function-name "${function_name}" --environment Variables={`cat .env | tr -s "\n" | tr '\n' ',' | sed s/,$//`} --runtime "nodejs18.x" | cat
echo "Updated ${function_name} environment variables"
# zip quit
zip -q -r deploy.zip . -x "*.git*" -x "*.env*" -x "*.DS_Store*" -x "*deploy.sh*" -x "*README.md*"
echo "Zipped ${function_name}"

aws lambda update-function-code --function-name "${function_name}" --zip-file fileb://deploy.zip | cat

echo "Deployed ${function_name}"
