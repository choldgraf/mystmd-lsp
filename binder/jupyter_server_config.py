# JupyterLab on the demo project, with this repo's build of the server registered in jupyterlab-lsp (see docs/editors.md).
# postBuild symlinks this file into ~/.jupyter/, so resolve the link to find the repo.
import os

repo = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
# jupyterlab-lsp sends root_dir to the server as the workspace folder, so point it at the demo for the server to find the demo's myst.yml.
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
