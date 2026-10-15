# JupyterLab on the demo project, with this repo's build of the server registered in jupyterlab-lsp (see docs/editors.md).
# postBuild symlinks this file into ~/.jupyter/, so resolve the link to find the repo.
import os

repo = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
# A file's project is the nearest myst.yml between it and the workspace root, which jupyterlab-lsp takes from root_dir.
c.ServerApp.root_dir = f"{repo}/demo"
c.LanguageServerManager.language_servers = {
    "mystmd-lsp": {
        "version": 2,
        "argv": ["node", f"{repo}/packages/server/dist/server.cjs", "--stdio"],
        "languages": ["markdown"],
        "mime_types": ["text/markdown", "text/x-markdown"],
        "display_name": "mystmd-lsp",
    }
}
