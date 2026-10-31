"""Unit tests for CIS Container Security Auditor."""
import unittest
from orbitdock.backend.smart.security import audit_container_security

class TestSecurity(unittest.TestCase):

    def test_insecure_privileged_root_container(self):
        attrs = {
            "Config": {"User": "root"},
            "HostConfig": {
                "Privileged": True,
                "Binds": ["/var/run/docker.sock:/var/run/docker.sock"],
                "NetworkMode": "host",
                "CapAdd": ["SYS_ADMIN"]
            }
        }
        sec = audit_container_security(attrs)
        self.assertLessEqual(sec["score"], 40)
        self.assertEqual(sec["grade"], "F")
        self.assertGreaterEqual(sec["critical_count"], 2)

    def test_hardened_container(self):
        attrs = {
            "Config": {"User": "1000:1000"},
            "HostConfig": {
                "Privileged": False,
                "Binds": ["/opt/data:/app/data"],
                "NetworkMode": "bridge",
                "CapAdd": [],
                "ReadonlyRootfs": True
            }
        }
        sec = audit_container_security(attrs)
        self.assertGreaterEqual(sec["score"], 90)
        self.assertEqual(sec["grade"], "A")
        self.assertEqual(sec["critical_count"], 0)

if __name__ == "__main__":
    unittest.main()
