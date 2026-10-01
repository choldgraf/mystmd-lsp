import shutil


def spec(manager):
    """The jupyter-lsp spec for mystmd-lsp, found through the `jupyter_lsp_spec_v1` entry point."""
    return {
        "mystmd-lsp": {
            "version": 2,
            "display_name": "mystmd-lsp",
            "argv": [shutil.which("mystmd-lsp") or "mystmd-lsp", "--stdio"],
            "languages": ["markdown"],
            "mime_types": ["text/markdown", "text/x-markdown"],
        }
    }
