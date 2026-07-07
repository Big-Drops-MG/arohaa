import subprocess
import sys
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
TERRAFORM_DIR = REPO_ROOT / "terraform"

IMPORTS = [
    ("aws_ecr_repository.api", "arohaa-api"),
    (
        "aws_cloudwatch_metric_alarm.analytics_queue_depth",
        "arohaa-analytics-queue-depth",
    ),
    (
        "aws_cloudwatch_metric_alarm.failed_events_depth",
        "arohaa-failed-events-depth",
    ),
    (
        "aws_iam_user_policy.api_queue_monitoring",
        "arohaa-backend-logger:arohaa-queue-monitoring",
    ),
    (
        "aws_cloudwatch_log_group.api",
        "/arohaa/production/fastify-backend",
    ),
    (
        "aws_cloudwatch_log_group.api_ecs",
        "/ecs/arohaa-api",
    ),
    (
        "aws_s3_bucket.terraform_state",
        "arohaa-terraform-state-442042553666",
    ),
    (
        "aws_dynamodb_table.terraform_locks",
        "arohaa-terraform-locks",
    ),
    (
        "aws_ecs_service.api",
        "arohaa-production/arohaa-api-service-syjf98zg",
    ),
]


def run(cmd: list[str], *, cwd: Path) -> None:
    print(">>>", " ".join(cmd))
    result = subprocess.run(cmd, cwd=cwd, text=True)
    if result.returncode != 0:
        sys.exit(result.returncode)


def terraform_bin() -> list[str]:
    if shutil.which("terraform"):
        return ["terraform"]
    return [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{REPO_ROOT}:/workspace",
        "-w",
        "/workspace/terraform",
        "-e",
        "AWS_ACCESS_KEY_ID",
        "-e",
        "AWS_SECRET_ACCESS_KEY",
        "-e",
        "AWS_REGION",
        "-e",
        "AWS_DEFAULT_REGION",
        "hashicorp/terraform:1.9",
    ]


def main() -> None:
    tf = terraform_bin()
    run(tf + ["init"], cwd=TERRAFORM_DIR if tf[0] == "terraform" else REPO_ROOT)

    for resource, resource_id in IMPORTS:
        result = subprocess.run(
            tf + ["import", resource, resource_id],
            cwd=TERRAFORM_DIR if tf[0] == "terraform" else REPO_ROOT,
            text=True,
        )
        if result.returncode != 0:
            print(f"Import skipped or failed for {resource}: {resource_id}")

    print("Import pass complete. Run terraform apply in terraform/")


if __name__ == "__main__":
    main()
