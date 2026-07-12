"""Base interface every engine driver must implement."""

import os
import abc


class BaseDriver(abc.ABC):
    #: Engine key, must match a key in engine_drivers.DRIVERS
    key = None
    #: Human friendly label
    label = None
    #: Default port when a server is registered without one
    default_port = 5432
    #: URI scheme used in connection strings (e.g. postgres://, cassandra://)
    scheme = None
    #: Default super-user/role name for a freshly registered server of this engine.
    _default_root_user = 'postgres'

    @classmethod
    def root_user_default(cls):
        return cls._default_root_user

    # ------------------------------------------------------------------
    # Provisioning lifecycle
    # ------------------------------------------------------------------
    @abc.abstractmethod
    def provision(self, server, instance):
        """Create the database/keyspace + role for ``instance`` on ``server``.

        Must set ``instance.status = 'available'`` on success or ``'failed'``
        on error and ``instance.save()``. Subclasses should catch exceptions
        and mark the instance failed rather than raising.
        """

    @abc.abstractmethod
    def delete(self, server, instance):
        """Soft-delete: revoke access but keep the data intact.

        Raises on failure so the caller can return a 500.
        """

    @abc.abstractmethod
    def build_connection_string(self, server, instance):
        """Return a URI usable by the consuming application."""

    # ------------------------------------------------------------------
    # Backup / restore (used by Celery tasks + studio download)
    # ------------------------------------------------------------------
    @abc.abstractmethod
    def backup(self, server, instance, dest_path):
        """Dump ``instance`` to ``dest_path`` (file or directory).

        Returns the path actually written.
        """

    @abc.abstractmethod
    def restore(self, server, instance, src_path):
        """Restore ``instance`` from ``src_path`` produced by :meth:`backup`."""

    # ------------------------------------------------------------------
    # Studio (ad-hoc query / browsing) — engine specific
    # ------------------------------------------------------------------
    @abc.abstractmethod
    def connect(self, server, instance):
        """Return an engine-native connection/session object."""

    @abc.abstractmethod
    def get_tables(self, connection, instance):
        """Return a list of table/column-family names for ``instance``."""

    @abc.abstractmethod
    def get_table_data(self, connection, instance, table_name):
        """Return ``{columns, primary_keys, rows}`` for a single table."""

    @abc.abstractmethod
    def execute_query(self, connection, query):
        """Run an arbitrary query. Return ``{columns, rows}``."""

    @abc.abstractmethod
    def close(self, connection):
        """Close the engine-native connection object."""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _random_password(length=16):
        import secrets
        import string
        return ''.join(
            secrets.choice(string.ascii_letters + string.digits)
            for _ in range(length)
        )

    @staticmethod
    def _safe_name(name):
        """Normalise a project slug into a valid identifier for this engine."""
        return name.replace('-', '_')[:50]
