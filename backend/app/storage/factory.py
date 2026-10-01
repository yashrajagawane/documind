from app.core.config import get_settings
from app.storage.local import LocalStorage
from app.storage.ports import PrivateStorage


class StorageConfigurationError(RuntimeError):
    """Raised when a configured private storage adapter is not available."""


def get_storage() -> PrivateStorage:
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalStorage(settings.storage_dir)
    raise StorageConfigurationError(
        "The configured storage backend is unavailable. Configure the object-storage adapter first."
    )
