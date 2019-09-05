#!/bin/bash
gcloud functions deploy api --runtime=nodejs10 --project realworldgcp --set-env-vars  DATASTORE_NAMESPACE=test-api-cloud-`date +%s` --trigger-http
