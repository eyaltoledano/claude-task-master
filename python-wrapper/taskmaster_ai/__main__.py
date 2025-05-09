import os, subprocess, sys, shutil, textwrap

def _ensure_cli():
    if not shutil.which("task-master"):
        # We fall back to a one‑shot install in a user cache dir
        cmd = ["npx", "-y", "--package=task-master-ai", "task-master-ai"]
    else:
        cmd = ["task-master"]           # global or project install
    return cmd + sys.argv[1:]

def main():
    subprocess.run(_ensure_cli(), check=True)

if __name__ == "__main__":
    main() 