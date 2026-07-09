---
name: helm
description: Manage Helm charts for Kubernetes deployment. Lint, template, and publish charts as OCI artifacts to GHCR.
argument-hint: [lint | template | package | lint:yamcs | lint:openmct | lint:jupyter | lint:sle]
---

# Helm Chart Management

Manage the Helm charts for Kubernetes deployment. Based on `$ARGUMENTS`. Default to `lint` if no argument given.

## Commands

### `lint` — Lint all charts

```bash
task helm:lint
```

### `lint:<chart>` — Lint one chart

```bash
task helm:lint:yamcs
task helm:lint:openmct
task helm:lint:jupyter
task helm:lint:sle
```

### `package` — Package all charts

```bash
task helm:package
```

Packages all charts into `dist/` as `.tgz` archives, matching the CI workflow's `helm package` step.

### `template` — Render all templates locally

```bash
task helm:template
```

Renders all chart templates with default values — useful for verifying template logic.

## Charts

| Chart | Default Port | Key Env Vars |
|-------|-------------|-------------|
| yamcs | 8090 | `MAVEN_HTTPS_PROXY`, `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `DEPLOYMENT_ENVIRO` |
| openmct | 9000 | Same as yamcs + `YAMCS_INSTANCE`, `YAMCS_PROCESSOR`, `YAMCS_FOLDER` |
| jupyter | 8000 | (extraEnv only) |
| sle | 5100 | `MAVEN_HTTPS_PROXY`, `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `DEPLOYMENT_ENVIRO` |

## Chart Structure

Each chart follows the same structure:

```
helm/<chart>/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml      # Entrypoint script
    ├── _helpers.tpl
    ├── hpa.yaml
    ├── ingress.yaml
    ├── serviceaccount.yaml
    └── NOTES.txt
```

## Extension Points

Every chart exposes these values:

| Value | Purpose |
|-------|---------|
| `image.repository` / `image.tag` | Use a mission-specific image |
| `env.*` | Proxy and deployment environment variables |
| `extraEnv` | Inject additional environment variables |
| `extraVolumes` / `extraVolumeMounts` | Mount XTCE databases, procedures, configs |
| `resources` | Set CPU/memory requests and limits |
| `nodeSelector` / `tolerations` / `affinity` | Control pod scheduling |

## ConfigMap Entrypoint

Each chart has a ConfigMap (`configmap.yaml`) that mirrors the container's `entrypoint.sh`. The deployment:
1. Mounts the ConfigMap as a volume
2. Uses `subPath: entrypoint.sh` at `mountPath: /entrypoint.sh`
3. Sets `command: ["/entrypoint.sh"]`

This allows missions to override the entrypoint without rebuilding the image.

## Install from GHCR

```bash
helm install yamcs oci://ghcr.io/spacecompute/mission-control-systems/charts/yamcs
```

## Override for a Mission

```yaml
# myspacecraft-yamcs.yaml
image:
  repository: ghcr.io/spacecompute/myspacecraft/yamcs
  tag: "1.2.0"

extraVolumeMounts:
  - name: xtce
    mountPath: /opt/yamcs/mdb

extraVolumes:
  - name: xtce
    configMap:
      name: myspacecraft-xtce
```

```bash
helm install myspacecraft-yamcs oci://ghcr.io/spacecompute/mission-control-systems/charts/yamcs \
  -f myspacecraft-yamcs.yaml
```

## Key Files

| Role | Path |
|------|------|
| Yamcs Chart | `helm/yamcs/` |
| OpenMCT Chart | `helm/openmct/` |
| Jupyter Chart | `helm/jupyter/` |
| SLE Chart | `helm/sle/` |
| CI Workflow | `.github/workflows/publish-charts.yaml` |
| Helm README | `helm/README.md` |

## Consistency Checklist

When modifying charts, verify:
- ConfigMap entrypoint matches `containers/<service>/entrypoint.sh`
- Deployment `command:` and `mountPath:` both use `/entrypoint.sh`
- Helm `env.*` vars match Containerfile `ARG`/`ENV` declarations
- Build-time ARGs (`GIT_URL`, `GIT_COMMIT`) are NOT in Helm values
