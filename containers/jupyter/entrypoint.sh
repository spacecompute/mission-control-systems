#!/usr/bin/env bash

# If running as root (Docker Compose), fix bind-mount ownership and drop privileges.
# If already non-root (Kubernetes with runAsUser), run directly.
if [ "$(id -u)" = "0" ]; then
    chown -R "${SERVICE_UID}:${SERVICE_GID}" /opt/jupyter /srv/procedures /srv/lib 2>/dev/null || true

    # Shared volumes: set group to shared GID and setgid bit so new files
    # inherit the shared group. In Kubernetes, fsGroup handles this instead.
    if [ -n "${SHARED_GID}" ]; then
        for dir in /srv/procedures /srv/lib; do
            chgrp -R "${SHARED_GID}" "${dir}" 2>/dev/null || true
            chmod -R g+rwX "${dir}" 2>/dev/null || true
            find "${dir}" -type d -exec chmod g+s {} + 2>/dev/null || true
            setfacl -R -d -m g::rwX "${dir}" 2>/dev/null || true
        done
    fi

    exec gosu "${SERVICE_UID}:${SERVICE_GID}" "$0" "$@"
fi

# Explicit cd — WORKDIR is not guaranteed when overridden via Helm ConfigMap
cd /opt/jupyter
jupyterhub -f ./jupyterhub_config.py

tail -f /dev/null
