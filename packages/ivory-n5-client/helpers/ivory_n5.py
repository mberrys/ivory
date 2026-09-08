"""N5 HTTP helper for the existing execution contract; no local research state."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(path, body=None, key=None):
    headers = {"Accept": "application/json"}
    if body is not None:
        headers.update({"Content-Type": "application/json"})
        if key:
            headers.update({"Idempotency-Key": key})
    base = os.environ.get("IVORY_N5_SERVICE_URL", "http://127.0.0.1:4100").rstrip("/")
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Preserve service conflict payload; do not resolve conflicts locally.
        raise RuntimeError(json.dumps({"status": error.code, "body": json.load(error)})) from error


def submit(body, key):
    if not key or not key.strip():
        raise ValueError("Supply and retain an Idempotency-Key")
    return request("/v1/executions", body, key)


def get(execution_id):
    return request("/v1/executions/" + urllib.parse.quote(execution_id, safe=""))


def open(body):
    return request("/v1/projects/open", body)


def cite(body):
    return request("/v1/citations/resolve", body)


def run(body):
    return request("/v1/runspecs/resolve", body)


def edit(body, key):
    if not key or not key.strip():
        raise ValueError("Supply and retain an Idempotency-Key")
    return request("/v1/projects/edits", body, key)


if __name__ == "__main__":
    import builtins

    try:
        args = sys.argv[1:]
        if args == ["ready"]:
            result = request("/health/ready")
        elif len(args) == 2 and args[0] == "get":
            result = get(args[1])
        elif len(args) == 3 and args[0] == "submit":
            with builtins.open(args[1], encoding="utf-8") as source:
                result = submit(json.load(source), args[2])
        elif len(args) == 2 and args[0] in ("open", "cite", "run"):
            with builtins.open(args[1], encoding="utf-8") as source:
                result = {"open": open, "cite": cite, "run": run}[args[0]](json.load(source))
        elif len(args) == 3 and args[0] == "edit":
            with builtins.open(args[1], encoding="utf-8") as source:
                result = edit(json.load(source), args[2])
        else:
            raise ValueError("Usage: ivory_n5.py ready | get ID | submit REQUEST.json KEY | open|cite|run REQUEST.json | edit REQUEST.json KEY")
        print(json.dumps(result))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
