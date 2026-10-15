import pytest


@pytest.fixture
def anyio_backend():
    """Limit anyio to asyncio since trio is not installed."""
    return "asyncio"
