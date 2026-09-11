import errno
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path


INPUT = Path("/var/tmp/input.csv")
OUTPUT = Path("/tmp")

# errno -> the control that refused the action. Anything else (notably ENOENT)
# is recorded as "absence": the resource was not reachable at all, which is
# corroborating evidence only, never proof of enforcement.
ENFORCED_BASIS = {
    errno.EROFS: "read-only-filesystem",
    errno.EACCES: "permission-denied",
    errno.EPERM: "operation-not-permitted",
    errno.ENETUNREACH: "network-unreachable",
    errno.ENETDOWN: "network-down",
    errno.EHOSTUNREACH: "host-unreachable",
}


def attempt(name, action):
    try:
        action()
    except BaseException as error:  # The fixture records denial; it must not hide a canary pass.
        basis = "absence"
        if isinstance(error, OSError) and error.errno in ENFORCED_BASIS:
            basis = ENFORCED_BASIS[error.errno]
        return {
            "name": name,
            "denied": True,
            "basis": basis,
            "error": type(error).__name__,
            "errno": getattr(error, "errno", None),
        }
    return {"name": name, "denied": False, "basis": "not-denied"}


def hostile():
    canaries = []
    canaries.append(attempt("canonical-file-write", lambda: INPUT.write_text(INPUT.read_text() + "4,40\n")))

    def symlink_escape():
        link = OUTPUT / "escape-link"
        link.symlink_to(INPUT)
        link.write_text("escape\n")

    canaries.append(attempt("path-symlink-escape", symlink_escape))

    def host_home_read():
        for candidate in ("/host-home/.ssh/id_rsa", "/root/.ssh/id_rsa"):
            try:
                return Path(candidate).read_text()
            except FileNotFoundError:
                pass
        raise FileNotFoundError("host home is not mounted")

    canaries.append(attempt("host-home-read", host_home_read))

    def network_egress():
        with socket.create_connection(("example.com", 80), timeout=2):
            pass

    canaries.append(attempt("network-egress", network_egress))
    canaries.append(attempt("process-escape", lambda: Path("/var/run/docker.sock").read_bytes()))

    # This canary cannot deny itself; only the supervisor can terminate the child.
    # It therefore reports no denial and is judged solely by the supervisor's
    # termination observation recorded in the evidence bundle.
    child = subprocess.Popen(["sh", "-c", "sleep 120"])
    canaries.append({"name": "child-process", "denied": None, "basis": "supervisor-observed", "childPid": child.pid})

    report = OUTPUT / "canaries.json"
    with report.open("w") as handle:
        handle.write(json.dumps(canaries) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    print("N3_CANARIES_RECORDED", flush=True)
    for _ in range(1024):
        print("N3_OUTPUT_CANARY", "x" * 1024, flush=True)
    time.sleep(120)


def valid():
    rows = INPUT.read_text().splitlines()[1:]
    values = [int(row.split(",")[1]) for row in rows]
    result = {"rowCount": len(values), "sum": sum(values), "mean": sum(values) / len(values)}
    target = OUTPUT / "result.json"
    target.write_text(json.dumps(result, sort_keys=True) + "\n")
    print("N3_RESULT_RECORDED", flush=True)


if __name__ == "__main__":
    if "--hostile" in sys.argv:
        hostile()
    else:
        valid()
