import os
import subprocess
import sys
import time
from pathlib import Path

import boto3

REPO_ROOT = Path(__file__).resolve().parents[1]
CLUSTER = "arohaa-production"
SERVICE = "arohaa-api-service-syjf98zg"
ECR_REGISTRY = "442042553666.dkr.ecr.us-east-1.amazonaws.com"
ECR_URI = f"{ECR_REGISTRY}/arohaa-api"
REGION = os.environ.get("AWS_REGION", "us-east-1")


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    print(">>>", " ".join(cmd))
    result = subprocess.run(cmd, cwd=cwd, text=True)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    password = subprocess.run(
        ["aws", "ecr", "get-login-password", "--region", REGION],
        text=True,
        capture_output=True,
        check=True,
    ).stdout.strip()
    subprocess.run(
        ["docker", "login", "--username", "AWS", "--password-stdin", ECR_REGISTRY],
        input=password,
        text=True,
        check=True,
    )

    run(
        ["docker", "build", "-f", "apps/api/Dockerfile", "-t", f"{ECR_URI}:latest", "."],
        cwd=REPO_ROOT,
    )
    run(["docker", "push", f"{ECR_URI}:latest"])

    ecs = boto3.client("ecs", region_name=REGION)
    ecs.update_service(cluster=CLUSTER, service=SERVICE, forceNewDeployment=True)
    print("ECS deployment started. Waiting for rollout...")

    for _ in range(40):
        svc = ecs.describe_services(cluster=CLUSTER, services=[SERVICE])["services"][0]
        primary = next((d for d in svc.get("deployments", []) if d["status"] == "PRIMARY"), None)
        if primary and primary.get("rolloutState") == "COMPLETED":
            print("Rollout completed.")
            break
        state = primary.get("rolloutState", "UNKNOWN") if primary else "UNKNOWN"
        running = primary["runningCount"] if primary else 0
        desired = primary["desiredCount"] if primary else 0
        print(f"  rollout={state} running={running}/{desired}")
        time.sleep(15)
    else:
        print("Rollout still in progress — check AWS console.")


if __name__ == "__main__":
    main()
