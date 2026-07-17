# Security Audit

Findings from a security review of the base container images, Helm charts, CI workflows, and configuration.

## Critical

### ~~C1. All containers run as root~~ (RESOLVED)

Each Containerfile now creates a dedicated service user with configurable UID/GID (`ARG SERVICE_UID/SERVICE_GID`) and sets `USER` to that service user. Entrypoints include a `gosu` guard: when Docker Compose overrides `user: "0:0"` to fix bind-mount ownership, the entrypoint drops back to the service user via `gosu`. In Kubernetes, `podSecurityContext` with `runAsUser` and `runAsNonRoot: true` enforces non-root directly, bypassing the gosu path.

- yamcs (10001), openmct (10002), jupyter (10003), jsle (10004)

### C2. JupyterHub uses dummy auth with hardcoded password

`containers/jupyter/jupyterhub_config.py` sets `authenticator_class = 'dummy'` with `password = 'password'`. This is baked into the image. Even though the comment says "development", the image ships to GHCR and can be deployed as-is.

### ~~C3. JupyterHub notebooks run as root~~ (RESOLVED)

`containers/jupyter/jupyterhub_config.py` passes `--allow-root` to spawned notebooks. Resolved by C1: the Containerfile sets `USER 10003:10003`, so the spawner is never root and `--allow-root` is a no-op. The flag can be removed as cleanup.

## High

### ~~H1. `sudo` installed in OpenMCT image~~ (RESOLVED)

Removed `sudo` from both `apt-get` blocks in `containers/openmct/Containerfile`.

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

### ~~H6. No `runAsNonRoot: true` enforcement~~ (RESOLVED)

All deployment templates enforce `runAsNonRoot: true` at the container level in each main container's `securityContext`. Pod-level `podSecurityContext` sets `runAsUser`, `runAsGroup`, `fsGroup`, and `supplementalGroups`. The `runAsNonRoot` constraint is at container level so that `initContainers` (e.g., volume-permissions) can run as root when needed.

### H7. Hardcoded admin auth header in OpenMCT webpack proxy

`containers/openmct/webpack.dev.mjs` sets `X-Auth-Auid: admin` in both HTTP and WebSocket proxy configurations. This hardcoded admin identity is baked into the image and used for all Yamcs API requests. Anyone with access to the OpenMCT UI or the proxy has implicit admin-level Yamcs access with no authentication challenge.

### H8. Trivy scan does not gate image publication

`.github/workflows/build-images.yaml` sets `exit-code: '0'` on the Trivy scan step, meaning CRITICAL and HIGH vulnerabilities are reported but never block image publication. A CVE-laden image is pushed to GHCR and tagged `latest` with no gate. Change `exit-code` to `'1'` to fail the pipeline on findings.

### H9. Inconsistent `runAsNonRoot` at pod level

OpenMCT and SLE set `runAsNonRoot: true` in `podSecurityContext` (`helm/openmct/values.yaml`, `helm/sle/values.yaml`), while Yamcs and Jupyter omit it at pod level. Per the H6 resolution, `runAsNonRoot` was intentionally placed at the container level so `initContainers` can run as root when needed. OpenMCT and SLE having it at pod level contradicts this convention and blocks root `initContainers`.

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

### ~~M7. CI `lint` job missing `permissions` block~~ (RESOLVED)

The `publish` job in `.github/workflows/publish-charts.yaml` now has explicit `permissions: contents: read, packages: write`. The `lint` job inherits default read-only permissions, which follows least-privilege.

### M8. No `readinessProbe` on any deployment

All four Helm charts define `livenessProbe` but no `readinessProbe`. Kubernetes routes traffic to pods that are alive but not yet ready (e.g., Yamcs compiling Maven dependencies, OpenMCT running `npm start`). This causes connection errors during startup and rolling updates.

### M9. Acknowledged but unpatched CVEs in OpenMCT image

`containers/openmct/Containerfile` documents two dependency families that cannot be patched via npm overrides:

- `mathjs` 13.x — CVE-2026-40897, CVE-2026-41139 (upstream openmct-yamcs pins to 13.1.1; fix requires major version jump to 15.x with breaking API changes)
- `undici` 6.26 — CVE-2026-12151 (bundled inside the Node.js runtime at `/opt/nvm/.../npm/node_modules/undici`, not addressable via npm overrides; requires a Node.js release with the fix)

### M10. No `set -e` in most entrypoints

Only the Yamcs Helm ConfigMap entrypoint uses `set -e`. The four container-baked entrypoints and the other three Helm entrypoints silently ignore failures. A failed `chown`, `gosu`, or service start command falls through to `tail -f /dev/null` (OpenMCT, Jupyter) or exits silently (Yamcs, SLE).

### M11. ConfigMap entrypoint injection surface

All four charts inject entrypoints via ConfigMap. Any principal with `configmaps:update` permission in the namespace can replace the entrypoint with arbitrary code that runs as the service user. This is by design for mission-specific overrides, but there is no admission control or policy enforcement to validate entrypoint content.

## Low

### L1. Dev utilities in production images

`vim`, `tmux`, `tree`, `wget`, `curl`, `iputils-ping` are installed in all images. These expand the attack surface. Consider a multi-stage build that excludes dev tools from the final image.

### L2. `tail -f /dev/null` in entrypoints

`containers/openmct/entrypoint.sh` and `containers/jupyter/entrypoint.sh` keep the container alive after the main process exits. This masks crashes and leaves a shell available via `kubectl exec` (as the service user, not root, since C1 was resolved).

### ~~L3. No image scanning in CI~~ (RESOLVED)

A Trivy scan job now runs between `build` and `merge`/`manifest` in both `build-images.yaml` (GitHub Actions) and `.gitlab-ci.yml`. Each image is scanned by digest on both amd64 and arm64 before being tagged as `latest`. GitHub results go to the Security tab via SARIF; GitLab results surface in the MR security widget and Vulnerability Report.

### L4. Weekly scheduled rebuild without notifications

`.github/workflows/build-images.yaml` has a cron rebuild that picks up upstream changes, but there is no diff or vulnerability report, so breakage or new CVEs go unnoticed.

### L5. No image signing or provenance attestation

Neither GitHub Actions nor GitLab CI signs published images with cosign/sigstore or generates SLSA provenance attestations. Consumers cannot verify image authenticity or build provenance.

### L6. No SBOM generation

No workflow generates a Software Bill of Materials. Without SBOMs, downstream consumers cannot audit transitive dependencies or correlate against new CVE disclosures without rebuilding.

### L7. `pkill` in OpenMCT entrypoint

`containers/openmct/entrypoint.sh` and the Helm ConfigMap entrypoint run `pkill -f node` and `pkill -f npm` before `npm start`. In a pod with sidecar containers or shared PID namespaces, this could kill unrelated Node.js processes.

## Summary

| Severity | Total | Resolved | Open |
|----------|-------|----------|------|
| Critical | 3 | 2 | **1** |
| High | 9 | 3 | **6** |
| Medium | 11 | 1 | **10** |
| Low | 7 | 1 | **6** |

Resolved: C1, C3, H1, H6, L3, M7.

The highest-impact open finding is **C2**: replacing the dummy JupyterHub authenticator with a real one. The most actionable new finding is **H8** (Trivy not gating builds) — a one-line `exit-code` change.
