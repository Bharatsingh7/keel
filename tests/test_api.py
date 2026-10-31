"""Integration tests for OrbitDock FastAPI REST endpoints."""
import unittest
from fastapi.testclient import TestClient
from orbitdock.backend.app import app

class TestAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_system_info(self):
        resp = self.client.get("/api/system/info")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("host", data)
        self.assertIn("docker", data)
        self.assertIn("cpu_cores", data["host"])

    def test_disk_usage(self):
        resp = self.client.get("/api/system/disk-usage")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("total_size_mb", data)
        self.assertIn("total_reclaimable_mb", data)

    def test_presets(self):
        resp = self.client.get("/api/system/presets")
        self.assertEqual(resp.status_code, 200)
        presets = resp.json().get("presets", [])
        self.assertGreater(len(presets), 0)
        self.assertTrue(any(p["id"] == "postgres" for p in presets))

    def test_composerize_endpoint(self):
        payload = {"command": "docker run -d -p 6379:6379 --name my-redis redis:alpine"}
        resp = self.client.post("/api/stacks/composerize", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("compose_yaml", data)
        self.assertEqual(data["service_name"], "my-redis")

    def test_list_containers(self):
        resp = self.client.get("/api/containers?all=true")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("containers", data)

    def test_list_images(self):
        resp = self.client.get("/api/images")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("images", data)

    def test_list_volumes(self):
        resp = self.client.get("/api/volumes")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("volumes", data)

    def test_list_networks(self):
        resp = self.client.get("/api/networks")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("networks", data)

    def test_static_index_serving(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("OrbitDock", resp.text)

if __name__ == "__main__":
    unittest.main()
