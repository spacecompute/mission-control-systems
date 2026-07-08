# Helm Charts

Kubernetes deployment charts for mission control services. Published as OCI artifacts to GitHub Container Registry.

## Charts

| Chart | Default Port | Description |
|-------|-------------|-------------|
| [yamcs](yamcs/) | 8090 | Yamcs mission control server |
| [openmct](openmct/) | 9000 | OpenMCT web telemetry UI with Yamcs plugin |
| [jupyter](jupyter/) | 8000 | JupyterHub with multi-language kernel support |
| [sle](sle/) | 5100 | jSLE Space Link Extension provider |

## Install from GHCR

```bash
helm install yamcs oci://ghcr.io/spacecompute/mission-control-systems/charts/yamcs
```

## Override for a mission

Create a values file for your mission and pass it at install time:

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

## Extension points

Every chart exposes these values for mission-specific customization:

| Value | Purpose |
|-------|---------|
| `image.repository` / `image.tag` | Use a mission-specific image |
| `env.*` | Proxy and deployment environment variables (see below) |
| `extraEnv` | Inject additional environment variables |
| `extraVolumes` / `extraVolumeMounts` | Mount XTCE databases, procedures, configs |
| `resources` | Set CPU/memory requests and limits |
| `nodeSelector` / `tolerations` / `affinity` | Control pod scheduling |

All charts (except jupyter) expose common env vars: `MAVEN_HTTPS_PROXY`, `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`, `DEPLOYMENT_ENVIRO`.

OpenMCT additionally exposes `env.YAMCS_INSTANCE`, `env.YAMCS_PROCESSOR`, and `env.YAMCS_FOLDER`.

Each chart includes a ConfigMap-based entrypoint script that can be overridden per mission via `extraVolumes`/`extraVolumeMounts`.

## Local development

```bash
task helm:lint          # lint all charts
task helm:lint:yamcs    # lint one chart
task helm:template      # render all templates locally
```
