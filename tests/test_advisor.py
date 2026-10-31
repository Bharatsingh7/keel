"""Unit tests for Advisor: Memory leak detection & Port checks."""
import unittest
import time
from orbitdock.backend.smart.advisor import detect_memory_leak, check_host_port_available

class TestAdvisor(unittest.TestCase):

    def test_memory_leak_detection(self):
        # Monotonically increasing memory samples: 100MB, 110MB, 120MB, 130MB, 145MB, 160MB, 180MB
        base_time = time.time()
        samples = [
            (base_time + 0, 100 * 1024 * 1024),
            (base_time + 60, 115 * 1024 * 1024),
            (base_time + 120, 130 * 1024 * 1024),
            (base_time + 180, 150 * 1024 * 1024),
            (base_time + 240, 175 * 1024 * 1024),
            (base_time + 300, 205 * 1024 * 1024),
            (base_time + 360, 240 * 1024 * 1024),
        ]
        res = detect_memory_leak(samples)
        self.assertTrue(res["has_leak"])
        self.assertGreater(res["confidence"], 70)
        self.assertGreater(res["growth_percent"], 50)

    def test_stable_memory_no_leak(self):
        base_time = time.time()
        samples = [
            (base_time + 0, 100 * 1024 * 1024),
            (base_time + 60, 102 * 1024 * 1024),
            (base_time + 120, 98 * 1024 * 1024),
            (base_time + 180, 101 * 1024 * 1024),
            (base_time + 240, 99 * 1024 * 1024),
            (base_time + 300, 100 * 1024 * 1024),
        ]
        res = detect_memory_leak(samples)
        self.assertFalse(res["has_leak"])

    def test_port_check_invalid(self):
        avail, reason = check_host_port_available(999999)
        self.assertFalse(avail)
        self.assertIn("Invalid port", reason)

if __name__ == "__main__":
    unittest.main()
