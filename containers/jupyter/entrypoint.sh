#!/usr/bin/env bash

# Explicit cd — WORKDIR is not guaranteed when overridden via Helm ConfigMap
cd /opt/jupyter
jupyterhub -f ./jupyterhub_config.py

tail -f /dev/null
