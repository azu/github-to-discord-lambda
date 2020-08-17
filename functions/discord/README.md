# github-to-discord

Lambda bot that fetch own GitHub notifications/events and post to Discord.

## Installation

    cd functions/discord
    npm install
    npm run init 
    # create dynamodb table

## Requirement

- Install [Apex](https://github.com/apex/apex "Apex")
- GitHub token
- Discord Webhook URL

## Config

    cp functions/discord/function.example.json functions/discord/function.json
    # Edit function.json
    
You have to set these property.    

- Set `role` of lambda function
- Set `environment` to your token

**environment**:

- `GITHUB_USER_NAME`: Your GitHub id
- `GITHUB_TOKEN`: Your GitHub access token
- `G2T_ENABLE_PRIVATE_REPOSITORY`: If it is `"true"`, send event/notification of private repository
    - Default: `"false"` (string)
- `DISCORD_WEBHOOK`: [Discord Webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) for your channel
- `POST_BODY_LENGTH`: slice post body by the value

```json
{
  "name": "github-to-discord",
  "description": "GitHub Events to Discord",
  "runtime": "nodejs12.x",
  "memory": 128,
  "timeout": 15,
  "role": "arn:aws:iam::xxxxxxxxxxxx",
  "defaultEnvironment": "dev",
  "environment": {
    "GITHUB_USER_NAME": "XXXX",
    "GITHUB_TOKEN": "XXXX",
    "G2T_ENABLE_PRIVATE_REPOSITORY": "false",
    "DISCORD_WEBHOOK": "XXXX",
    "POST_BODY_LENGTH": "10000"
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

    apex deploy discord

## Cron

lambda function run at once by default.
You can set cron to lambda using [Scheduled Events - AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/with-scheduled-events.html "Using AWS Lambda with Scheduled Events - AWS Lambda").

I've setting to run this per 2 minutes.

![image](https://monosnap.com/file/lhJghW8bwKJmTZ3iDugi4B7eklRn5Z.png)

## Tests

Tests in local with dry-run.

    cd functions/discord
    npm test

Tests by apex

    apex invoke discord

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT
