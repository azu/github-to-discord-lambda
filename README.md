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

- `role` of lambda function
- set `environment` to your token

```
    "role": "arn:aws:iam::xxxxxxxxxxxx",
    "defaultEnvironment": "dev",
    "environment": {
        "GITHUB_TOKEN": "GitHub Person token need repo/notification/user",
        "TWITTER_CONSUMER_KEY": "app key",
        "TWITTER_CONSUMER_SECRET": "app secret",
        "TWITTER_ACCESS_TOKEN_KEY": "token key",
        "TWITTER_ACCESS_TOKEN_SECRET": "token  secret"
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