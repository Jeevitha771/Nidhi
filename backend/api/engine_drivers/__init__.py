"""
Engine driver abstraction for Nidhi's DBaaS control plane.

Each supported database engine implements :class:`BaseDriver`. The rest of the
codebase (views, tasks, studio) only talks to drivers via ``get_driver()`` so
adding a new engine means dropping in a new driver module — no call-site changes.
"""

from .base import BaseDriver
from .postgres import PostgresDriver
from .cassandra import CassandraDriver

# Engine key -> driver class. Add new engines here.
DRIVERS = {
    'postgresql': PostgresDriver,
    'cassandra': CassandraDriver,
}

DEFAULT_ENGINE = 'postgresql'

# Choices reused by models / serializers.
ENGINE_CHOICES = [(key, key.capitalize()) for key in DRIVERS]


def get_driver(engine):
    """Return the driver class for an engine key, falling back to PostgreSQL."""
    return DRIVERS.get(engine or DEFAULT_ENGINE, PostgresDriver)


def default_port_for_engine(engine):
    return getattr(get_driver(engine), 'default_port', 5432)


__all__ = [
    'BaseDriver', 'PostgresDriver', 'CassandraDriver',
    'DRIVERS', 'ENGINE_CHOICES', 'DEFAULT_ENGINE', 'get_driver',
    'default_port_for_engine',
]
