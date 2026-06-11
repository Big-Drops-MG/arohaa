import { execSync } from "node:child_process"
import { platform } from "node:os"

const DEV_PORTS = [3000, 3001, 3002]

function killPortOnUnix(port) {
  let output = ""
  try {
    output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return
  }

  for (const pid of output.split(/\s+/).filter(Boolean)) {
    try {
      process.kill(Number(pid), "SIGKILL")
    } catch {
      /* process may already be gone */
    }
  }
}

function killPortOnWindows(port) {
  let output = ""
  try {
    output = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim()
  } catch {
    return
  }

  for (const pid of output.split(/\s+/).filter(Boolean)) {
    try {
      execSync(
        `powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`,
        { stdio: "ignore" }
      )
    } catch {
      /* process may already be gone */
    }
  }
}

const killPort = platform() === "win32" ? killPortOnWindows : killPortOnUnix

for (const port of DEV_PORTS) {
  killPort(port)
}
