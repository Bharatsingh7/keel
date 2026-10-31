"""Unit tests for Composerize algorithm (docker run <-> compose)."""
import unittest
import yaml
from orbitdock.backend.smart.composerize import docker_run_to_compose, container_to_docker_run

class TestComposerize(unittest.TestCase):

    def test_basic_docker_run_conversion(self):
        cmd = "docker run -d -p 8080:80 --name my-web -v /host/data:/app/data -e ENV=production --restart always nginx:alpine"
        result = docker_run_to_compose(cmd)
        
        self.assertEqual(result["service_name"], "my-web")
        self.assertEqual(result["image"], "nginx:alpine")
        
        compose = result["compose_dict"]
        service = compose["services"]["my-web"]
        
        self.assertEqual(service["image"], "nginx:alpine")
        self.assertEqual(service["ports"], ["8080:80"])
        self.assertEqual(service["volumes"], ["/host/data:/app/data"])
        self.assertEqual(service["environment"]["ENV"], "production")
        self.assertEqual(service["restart"], "always")

    def test_docker_run_with_command_and_flags(self):
        cmd = "docker run --rm -m 512m --privileged redis:7-alpine redis-server --appendonly yes"
        result = docker_run_to_compose(cmd)
        
        service = result["service"]
        self.assertEqual(service["image"], "redis:7-alpine")
        self.assertEqual(service["command"], "redis-server --appendonly yes")
        self.assertTrue(service["privileged"])
        self.assertEqual(service["deploy"]["resources"]["limits"]["memory"], "512m")

    def test_container_to_docker_run(self):
        attrs = {
            "Name": "/test-db",
            "Config": {
                "Image": "postgres:16-alpine",
                "Env": ["POSTGRES_PASSWORD=secret", "PATH=/usr/local/bin"],
                "Cmd": ["postgres"]
            },
            "HostConfig": {
                "PortBindings": {"5432/tcp": [{"HostIp": "0.0.0.0", "HostPort": "5432"}]},
                "Binds": ["/data/pg:/var/lib/postgresql/data:rw"],
                "RestartPolicy": {"Name": "unless-stopped"}
            }
        }
        run_cmd = container_to_docker_run(attrs)
        self.assertIn("docker run -d", run_cmd)
        self.assertIn("--name test-db", run_cmd)
        self.assertIn("postgres:16-alpine", run_cmd)
        self.assertIn("-p 5432:5432/tcp", run_cmd)
        self.assertIn("-e POSTGRES_PASSWORD=secret", run_cmd)

if __name__ == "__main__":
    unittest.main()
