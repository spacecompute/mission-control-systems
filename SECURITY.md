# Security Audit

Findings from a security review of the base container images, Helm charts, CI workflows, and configuration.

## Critical

### C1. All containers run as root

No `USER` directive in any Containerfile. No `groupadd`/`useradd` anywhere. No `runAsUser`/`runAsNonRoot` in any Helm chart. A container escape gives the attacker UID 0 on the node.

- `containers/yamcs/Containerfile`
- `containers/sle/Containerfile`
- `containers/openmct/Containerfile`
- `containers/jupyter/Containerfile`

### C2. JupyterHub uses dummy auth with hardcoded password

`containers/jupyter/jupyterhub_config.py` sets `authenticator_class = 'dummy'` with `password = 'password'`. This is baked into the image. Even though the comment says "development", the image ships to GHCR and can be deployed as-is.

### C3. JupyterHub notebooks run as root

`containers/jupyter/jupyterhub_config.py` passes `--allow-root` to spawned notebooks. Combined with no `USER` directive, all user notebook code executes as root.

## High

### H1. `sudo` installed in OpenMCT image

`containers/openmct/Containerfile` installs `sudo` in both `apt-get` blocks (lines 19 and 60). Directly undermines any future non-root enforcement.

### H2. Unpinned base images

All base image tags are mutable with no digest pinning:

- `FROM maven:3.9.9-eclipse-temurin-17`
- `FROM ubuntu:25.04`
- `FROM quay.io/jupyterhub/jupyterhub:5`

A supply-chain compromise of any upstream tag silently propagates. Pin by `@sha256:` digest.

### H3. Unpinned `git clone` of source repos at build time

All Containerfiles default to `GIT_COMMIT=master`. Cloning `master` means builds are non-reproducible and a compromised upstream commit is pulled silently. Default to a pinned tag or commit SHA.

- `containers/yamcs/Containerfile` — `GIT_COMMIT=master`
- `containers/sle/Containerfile` — `GIT_COMMIT=master`
- `containers/openmct/Containerfile` — `GIT_COMMIT=master`

### H4. `curl | bash` pattern in OpenMCT

`containers/openmct/Containerfile` uses `curl -o- ${NVM_URL} | bash` to install nvm. NVM_VERSION is pinned, but the download has no checksum verification.

### H5. No `readOnlyRootFilesystem` in any deployment

All four Helm deployment templates allow the container to write anywhere on its filesystem. Writable root filesystems let an attacker drop binaries, modify configs, or persist changes.

### H6. No `runAsNonRoot: true` enforcement at pod level

The deployment templates have `allowPrivilegeEscalation: false` and `capabilities.drop: [ALL]`, but without `runAsNonRoot: true`, Kubernetes will not reject a root container.

## Medium

### M1. No NetworkPolicy templates

No chart provides a NetworkPolicy. All pods can communicate with every other pod in the namespace and potentially the entire cluster.

### M2. Proxy credentials exposed as ENV

`MAVEN_HTTPS_PROXY`, `HTTPS_PROXY`, `HTTP_PROXY` are persisted as `ENV` in all Containerfiles. If these contain credentials (e.g., `http://user:pass@proxy:8080`), they are visible via `docker inspect`, `docker history`, and the Kubernetes pod spec. Use build-time-only `ARG` without `ENV` persistence, or inject at runtime via Secrets.

### M3. Entrypoint ConfigMaps mounted as 0755

All four charts set `defaultMode: 0755` on the entrypoint ConfigMap. This makes the script world-readable and world-executable. Use `0550` (owner+group execute, no world access).

### M4. No `seccompProfile` set

None of the deployments set `seccompProfile: RuntimeDefault`. Containers run without seccomp filtering unless the cluster enforces a default.

### M5. `.gitignore` is minimal

Only `dist/` and `charts/` are excluded. No exclusions for `.env`, `*.pem`, `*.key`, `settings.xml` (which could contain proxy credentials), IDE files, or OS artifacts.

### M6. `pip install` and `gem install` without version pins

`containers/jupyter/Containerfile` installs all pip and gem packages without version pins (`jupyterlab`, `iruby`, etc.). A compromised or yanked package version gets pulled into the image.

### M7. CI `lint` job missing `permissions` block

`.github/workflows/publish-charts.yaml` — the `lint` job inherits the default `GITHUB_TOKEN` permissions. Should explicitly set `contents: read` to follow least-privilege.

## Low

### L1. Dev utilities in production images

`vim`, `tmux`, `tree`, `wget`, `curl`, `iputils-ping` are installed in all images. These expand the attack surface. Consider a multi-stage build that excludes dev tools from the final image.

### L2. `tail -f /dev/null` in entrypoints

`containers/openmct/entrypoint.sh` and `containers/jupyter/entrypoint.sh` keep the container alive after the main process exits. This masks crashes and leaves a root shell available via `kubectl exec`.

### L3. No image scanning in CI

No Trivy, Grype, or Snyk step in `build-images.yaml`. Vulnerabilities in base images and dependencies are not caught before publishing.

### L4. Weekly scheduled rebuild without notifications

`.github/workflows/build-images.yaml` has a cron rebuild that picks up upstream changes, but there is no diff or vulnerability report, so breakage or new CVEs go unnoticed.

## Summary

| Severity | Count | Key theme |
|----------|-------|-----------|
| Critical | 3 | Root containers, hardcoded credentials, root notebooks |
| High | 6 | sudo, unpinned images/sources, curl\|bash, missing pod security |
| Medium | 7 | No NetworkPolicy, env credential leak, unpinned deps, seccomp |
| Low | 4 | Dev tools in prod, masked crashes, no image scanning |

The most impactful fix is **C1 + H6**: adding non-root users to Containerfiles and `runAsNonRoot: true` to deployments. That single change addresses or mitigates C1, C3, H1, H5, and L2.
