from jupyter_mystmd_lsp import spec


def test_spec():
    server = spec(None)["mystmd-lsp"]
    assert server["argv"][-1] == "--stdio"
    assert "markdown" in server["languages"]
