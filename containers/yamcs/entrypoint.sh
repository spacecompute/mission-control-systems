#!/usr/bin/env bash

# Explicit cd — WORKDIR is not guaranteed when overridden via Helm ConfigMap
cd /opt/yamcs
mvn ${MAVEN_HTTPS_PROXY} yamcs:run -Dmaven.repo.local=/opt/yamcs/.m2/repository
