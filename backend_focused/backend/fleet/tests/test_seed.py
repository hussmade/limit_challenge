from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings


class SeedTests(TestCase):
    @override_settings(DEBUG=True)
    def test_seed_is_repeatable(self):
        call_command("seed_fleet", stdout=StringIO())
        call_command("seed_fleet", stdout=StringIO())

    @override_settings(DEBUG=False)
    def test_seed_refuses_production(self):
        with self.assertRaises(CommandError):
            call_command("seed_fleet", stdout=StringIO())
