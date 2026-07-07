import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "137.184.17.135"
SSH_USER = "root"
SSH_PASSWORD = os.environ.get("DO_SSH_PASSWORD", "")

REPO_ROOT = Path(__file__).resolve().parents[1]
REMOTE_DIR = "/opt/arohaa-worker"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str]:
    print(f">>> {cmd[:100]}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if out:
        print(out.rstrip())
    if err:
        print(err.rstrip(), file=sys.stderr)
    return code, out


def main() -> None:
    if not SSH_PASSWORD:
        print("DO_SSH_PASSWORD required", file=sys.stderr)
        sys.exit(1)

    env_local = REPO_ROOT / "apps" / "dashboard" / ".env.local"
    env_dev = REPO_ROOT / "apps" / "dashboard" / ".env.development"

    def parse_env_file(path: Path) -> dict[str, str]:
        values: dict[str, str] = {}
        if not path.exists():
            return values
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"')
        return values

    merged = {**parse_env_file(env_dev), **parse_env_file(env_local)}

    def pick(key: str) -> str:
        return merged.get(key, "")

    worker_env = f"""NODE_ENV=production
REDIS_URL={pick("REDIS_URL") or pick("KV_URL")}
CLICKHOUSE_URL={pick("CLICKHOUSE_URL")}
CLICKHOUSE_USER={pick("CLICKHOUSE_USER")}
CLICKHOUSE_PASSWORD={pick("CLICKHOUSE_PASSWORD")}
SENTRY_DSN={pick("SENTRY_DSN")}
"""

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=SSH_USER, password=SSH_PASSWORD, timeout=30)

    run(client, f"mkdir -p {REMOTE_DIR}")

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tar_path = tmp.name
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(REPO_ROOT / "apps" / "worker" / "Dockerfile", arcname="Dockerfile")
        tar.add(REPO_ROOT / "apps" / "worker" / "package.json", arcname="package.json")
        tar.add(REPO_ROOT / "apps" / "worker" / "src", arcname="src")

    sftp = client.open_sftp()
    sftp.put(tar_path, f"{REMOTE_DIR}/worker.tar.gz")
    with sftp.file(f"{REMOTE_DIR}/worker.env", "w") as remote_env:
        remote_env.write(worker_env.replace("\r\n", "\n"))
    sftp.close()
    os.unlink(tar_path)

    cmds = [
        f"cd {REMOTE_DIR} && tar -xzf worker.tar.gz",
        f"cd {REMOTE_DIR} && docker build -t arohaa-worker .",
        "docker rm -f arohaa-worker 2>/dev/null || true",
        f"docker run -d --name arohaa-worker --restart unless-stopped --env-file {REMOTE_DIR}/worker.env arohaa-worker",
        "docker logs --tail 20 arohaa-worker",
    ]
    for cmd in cmds:
        code, _ = run(client, cmd, timeout=900)
        if code != 0:
            sys.exit(code)

    client.close()
    print("Worker deployed on DO.")


if __name__ == "__main__":
    main()
