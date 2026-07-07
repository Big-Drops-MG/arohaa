import json
import os
from pathlib import Path

import boto3

REGION = os.environ.get("AWS_REGION", "us-east-1")
NAMESPACE = "Arohaa/Custom"
REPO_ROOT = Path(__file__).resolve().parents[1]

ALARMS = [
    {
        "AlarmName": "arohaa-analytics-queue-depth",
        "AlarmDescription": "Alert when analytics_queue depth stays high (ARHT32)",
        "MetricName": "analytics_queue_depth",
        "Threshold": 5000,
    },
    {
        "AlarmName": "arohaa-failed-events-depth",
        "AlarmDescription": "Alert when failed_events DLQ depth stays high",
        "MetricName": "failed_events_depth",
        "Threshold": 100,
    },
]


def main() -> None:
    sns_arn = os.environ.get("CLOUDWATCH_ALARM_SNS_ARN", "").strip()
    cw = boto3.client("cloudwatch", region_name=REGION)

    for alarm in ALARMS:
        params = {
            "AlarmName": alarm["AlarmName"],
            "AlarmDescription": alarm["AlarmDescription"],
            "Namespace": NAMESPACE,
            "MetricName": alarm["MetricName"],
            "Statistic": "Maximum",
            "Period": 300,
            "EvaluationPeriods": 2,
            "Threshold": alarm["Threshold"],
            "ComparisonOperator": "GreaterThanThreshold",
            "TreatMissingData": "notBreaching",
        }
        if sns_arn:
            params["AlarmActions"] = [sns_arn]
            params["OKActions"] = [sns_arn]

        cw.put_metric_alarm(**params)
        print(f"Upserted alarm: {alarm['AlarmName']}")

    print("Done.")


if __name__ == "__main__":
    main()
