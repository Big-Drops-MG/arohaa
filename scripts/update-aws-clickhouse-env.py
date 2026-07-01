import json
import os
import subprocess
import sys
import time

import boto3

CLUSTER = "arohaa-production"
SERVICE = "arohaa-api-service-syjf98zg"

CLICKHOUSE_URL = "http://137.184.17.135:8123"
CLICKHOUSE_USER = "arohaa"
CLICKHOUSE_PASSWORD = "Arohaa_CH_xK9mP2vL7nQ4wR8"

UPDATES = {
    "CLICKHOUSE_URL": CLICKHOUSE_URL,
    "CLICKHOUSE_USER": CLICKHOUSE_USER,
    "CLICKHOUSE_PASSWORD": CLICKHOUSE_PASSWORD,
}


def main() -> None:
    ecs = boto3.client("ecs", region_name=os.environ.get("AWS_REGION", "us-east-1"))

    service = ecs.describe_services(cluster=CLUSTER, services=[SERVICE])["services"][0]
    task_def_arn = service["taskDefinition"]
    print(f"Current task definition: {task_def_arn}")

    task_def = ecs.describe_task_definition(taskDefinition=task_def_arn)["taskDefinition"]
    container = task_def["containerDefinitions"][0]

    for env in container.get("environment", []):
        if env["name"] in UPDATES:
            old = env["value"]
            new = UPDATES[env["name"]]
            print(f"Update {env['name']}: {old[:40]}... -> {new[:40]}...")
            env["value"] = new

    register_fields = [
        "family",
        "taskRoleArn",
        "executionRoleArn",
        "networkMode",
        "containerDefinitions",
        "volumes",
        "requiresCompatibilities",
        "cpu",
        "memory",
        "runtimePlatform",
    ]
    payload = {k: task_def[k] for k in register_fields if k in task_def and task_def[k] is not None}

    new_task_def = ecs.register_task_definition(**payload)["taskDefinition"]
    new_arn = new_task_def["taskDefinitionArn"]
    print(f"Registered: {new_arn}")

    ecs.update_service(
        cluster=CLUSTER,
        service=SERVICE,
        taskDefinition=new_arn,
        forceNewDeployment=True,
    )
    print("Deployment started. Waiting for rollout...")

    for _ in range(40):
        svc = ecs.describe_services(cluster=CLUSTER, services=[SERVICE])["services"][0]
        deployments = svc.get("deployments", [])
        primary = next((d for d in deployments if d["status"] == "PRIMARY"), None)
        if primary and primary.get("rolloutState") == "COMPLETED":
            print("Rollout completed.")
            break
        running = primary["runningCount"] if primary else 0
        desired = primary["desiredCount"] if primary else 0
        state = primary.get("rolloutState", "UNKNOWN") if primary else "UNKNOWN"
        print(f"  rollout={state} running={running}/{desired}")
        time.sleep(15)
    else:
        print("Rollout still in progress — check the AWS console.")

    result = subprocess.run(
        ["curl.exe", "-s", "https://api.arohaa.net/health"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    print("Health:", result.stdout.strip() or result.stderr.strip())


if __name__ == "__main__":
    main()
