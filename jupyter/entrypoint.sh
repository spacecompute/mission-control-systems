#!/usr/bin/env bash

jupyterhub -f ./jupyterhub_config.py

tail -f /dev/null
