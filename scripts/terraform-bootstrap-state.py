import os
import sys

import boto3
from botocore.exceptions import ClientError

ACCOUNT_ID = os.environ.get("AWS_ACCOUNT_ID", "442042553666")
REGION = os.environ.get("AWS_REGION", "us-east-1")
BUCKET = f"arohaa-terraform-state-{ACCOUNT_ID}"
TABLE = "arohaa-terraform-locks"


def main() -> None:
    s3 = boto3.client("s3", region_name=REGION)
    dynamodb = boto3.client("dynamodb", region_name=REGION)

    try:
        s3.head_bucket(Bucket=BUCKET)
        print(f"S3 bucket exists: {BUCKET}")
    except ClientError:
        print(f"Creating S3 bucket: {BUCKET}")
        if REGION == "us-east-1":
            s3.create_bucket(Bucket=BUCKET)
        else:
            s3.create_bucket(
                Bucket=BUCKET,
                CreateBucketConfiguration={"LocationConstraint": REGION},
            )
        s3.put_bucket_versioning(
            Bucket=BUCKET,
            VersioningConfiguration={"Status": "Enabled"},
        )
        s3.put_bucket_encryption(
            Bucket=BUCKET,
            ServerSideEncryptionConfiguration={
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256",
                        }
                    }
                ]
            },
        )
        s3.put_public_access_block(
            Bucket=BUCKET,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            },
        )

    try:
        dynamodb.describe_table(TableName=TABLE)
        print(f"DynamoDB table exists: {TABLE}")
    except ClientError:
        print(f"Creating DynamoDB table: {TABLE}")
        dynamodb.create_table(
            TableName=TABLE,
            AttributeDefinitions=[{"AttributeName": "LockID", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "LockID", "KeyType": "HASH"}],
            BillingMode="PAY_PER_REQUEST",
        )
        waiter = dynamodb.get_waiter("table_exists")
        waiter.wait(TableName=TABLE)

    print("Terraform remote state backend is ready.")


if __name__ == "__main__":
    main()
