#!/usr/bin/env bash
export GOOGLE_CLOUD_PROJECT=realworldgcp
export DATASTORE_EMULATOR_HOST=http://localhost:8081
forever -c 'nodemon --inspect=8082' node_modules/@google-cloud/functions-framework --target=api