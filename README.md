# github-to-twitter-lambda

Lambda bot that fetch own GitHub notifications/events and post to Twitter.

## Installation

    cd functions/notifications
    npm install
    npm run init 
    # create dynamodb table

## Requirement

- Install [Apex](https://github.com/apex/apex "Apex")
- GitHub token
- Twitter token

### Config

    cp project.example.json project.json
    # Edit project.example.json
    
You have to set these property.    

- Set `role` of lambda function
- Set `environment` to your token

**environment**:

- `GITHUB_USER_NAME`: Your GitHub id
- `GITHUB_TOKEN`: Your GitHub access token
- `TWITTER_CONSUMER_KEY`: Twitter consumer key
- `TWITTER_CONSUMER_SECRET`: Twitter consumer secret
- `TWITTER_ACCESS_TOKEN_KEY`: Twitter access key
- `TWITTER_ACCESS_TOKEN_SECRET`: Twitter access secret
- `G2T_ENABLE_PRIVATE_REPOSITORY`: If it is `"true"`, send event/notification about private repository
    - Default: `"false"` (string)

```json
{
  "name": "github-to-twitter",
  "description": "GitHub Events to Twitter",
  "runtime": "nodejs4.3",
  "memory": 128,
  "timeout": 8,
  "role": "arn:aws:iam::xxxxxxxxxxxx",
  "defaultEnvironment": "dev",
  "environment": {
    "GITHUB_USER_NAME": "username",
    "GITHUB_TOKEN": "GitHub Person token need repos/notification/user",
    "TWITTER_CONSUMER_KEY": "app key",
    "TWITTER_CONSUMER_SECRET": "app secret",
    "TWITTER_ACCESS_TOKEN_KEY": "token key",
    "TWITTER_ACCESS_TOKEN_SECRET": "token  secret",
    "G2T_ENABLE_PRIVATE_REPOSITORY": "false"
  }
}
```

### Lambda role policy

Lambda(`role": "arn:aws:iam::xxxxxxxxxxxx"`) should have following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "dynamodb:*",
                "lambda:*",
                "logs:*",
                "cloudwatch:*",
                "autoscaling:Describe*"
            ],
            "Effect": "Allow",
            "Resource": "*"
        }
    ]
}
```

### Deploy

This project use [Apex](https://github.com/apex/apex "Apex") fot deploy.

After setting config, deploy this.

    apex deploy notifications

## Cron

lambda function run at once by default.
You can set cron to lambda using [Scheduled Events - AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-scheduled-events.html "Using AWS Lambda with Scheduled Events - AWS Lambda").

I've setting to run this per 2 minutes.

![image](https://monosnap.com/file/lhJghW8bwKJmTZ3iDugi4B7eklRn5Z.png)

## Tests

Tests in local with dry-run.

    cd functions/notifications
    npm test

Tests by apex

    apex invoke notifications

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT
