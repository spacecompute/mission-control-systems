#!/usr/bin/env bash

# Explicit cd — WORKDIR is not guaranteed when overridden via Helm ConfigMap
cd /opt/jsle
mvn ${MAVEN_HTTPS_PROXY} exec:java -Dmaven.repo.local=/opt/jsle/.m2/repository
