"""Unit tests for Smart Crash-Loop and Failure Diagnostician."""
import unittest
from orbitdock.backend.smart.diagnostics import analyze_container_failure

class TestDiagnostics(unittest.TestCase):

    def test_healthy_running_container(self):
        attrs = {
            "State": {
                "Status": "running",
                "ExitCode": 0,
                "OOMKilled": False,
                "Error": ""
            }
        }
        diag = analyze_container_failure(attrs)
        self.assertIsNone(diag)

    def test_oom_killed_detection(self):
        attrs = {
            "State": {
                "Status": "exited",
                "ExitCode": 137,
                "OOMKilled": True,
                "Error": ""
            }
        }
        diag = analyze_container_failure(attrs, "fatal error: runtime: out of memory")
        self.assertIsNotNone(diag)
        self.assertEqual(diag["title"], "Out of Memory (OOMKilled)")
        self.assertEqual(diag["severity"], "critical")
        self.assertEqual(diag["remediation_action"], "increase_memory")

    def test_missing_database_password(self):
        attrs = {
            "State": {
                "Status": "exited",
                "ExitCode": 1,
                "OOMKilled": False,
                "Error": ""
            }
        }
        logs = "Error: Database is uninitialized and password option is not specified\nPOSTGRES_PASSWORD must be set"
        diag = analyze_container_failure(attrs, logs)
        self.assertIsNotNone(diag)
        self.assertEqual(diag["title"], "Missing Required Database Password")
        self.assertEqual(diag["remediation_action"], "edit_env")

    def test_port_collision_detection(self):
        attrs = {
            "State": {
                "Status": "exited",
                "ExitCode": 1,
                "OOMKilled": False,
                "Error": "driver failed programming external connectivity on endpoint: Bind for 0.0.0.0:80 failed: port is already allocated"
            }
        }
        diag = analyze_container_failure(attrs)
        self.assertIsNotNone(diag)
        self.assertEqual(diag["title"], "Port Collision Detected")
        self.assertEqual(diag["remediation_action"], "change_port")

    def test_command_not_found_127(self):
        attrs = {
            "State": {
                "Status": "exited",
                "ExitCode": 127,
                "OOMKilled": False,
                "Error": ""
            },
            "Config": {"Cmd": ["/bin/bash"]}
        }
        diag = analyze_container_failure(attrs)
        self.assertIsNotNone(diag)
        self.assertEqual(diag["exit_code"], 127)
        self.assertEqual(diag["remediation_action"], "fix_cmd")

if __name__ == "__main__":
    unittest.main()
