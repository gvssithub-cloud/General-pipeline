# General-pipeline

This repository contains a Node.js website for `arss-it-solutions.com`, deployed to AWS Lambda behind an Application Load Balancer using CloudFormation.

## Included files

- `index.js` — Node.js entrypoint and Lambda handler
- `package.json` — Node.js dependencies
- `public/` — static website assets
- `buildspec.yml` — CodeBuild build instructions
- `app-template.yml` — CloudFormation template for the Lambda + ALB application stack
- `pipeline-template.yml` — CloudFormation template for the CodePipeline stack

## Deployment flow

This setup uses GitHub Actions to package the app and deploy the CloudFormation application stack directly to AWS.

### Required GitHub Secrets

- `AWS_REGION` — AWS region, e.g. `us-east-1`
- `AWS_ROLE_TO_ASSUME` — IAM role ARN for GitHub Actions to assume
- `HOSTED_ZONE_ID` — Route53 hosted zone ID for `arss-it-solutions.com`
- `LAMBDA_BUCKET` — S3 bucket name for the Lambda deployment package

### GitHub Actions deployment

1. Push to `main`.
2. GitHub Actions runs `.github/workflows/deploy.yml`.
3. The workflow packages `lambda.zip`, uploads it to S3, and deploys `app-template.yml`.

The stack uses the following CloudFormation parameters:

- `LambdaCodeBucket` — S3 bucket containing `lambda.zip`
- `LambdaCodeKey` — S3 object key, default `lambda.zip`
- `DomainName` — `arss-it-solutions.com`
- `HostedZoneId` — Route53 hosted zone ID

## Notes

- `app-template.yml` creates a Lambda function, VPC, public subnets, an ALB, and Route53 A record when `HostedZoneId` is provided.
- `buildspec.yml` packages the app and uploads `lambda.zip` to the pipeline artifact bucket.
- For HTTPS support, add an ACM certificate and update the ALB listener.

## Local testing

Run locally with:

```bash
npm install
npm start
```

Then open `http://localhost:3000`.
