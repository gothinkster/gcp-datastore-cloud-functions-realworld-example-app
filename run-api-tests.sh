#!/bin/bash
set -e

echo PWD=`pwd`

## Deploy to Cloud Functions Local Emulator
echo "Using functions emulator located at: ["`which functions`"]"
export DATASTORE_NAMESPACE=test-api-`date +%s`
echo $GCP_PROJECT_ID | functions start > /dev/null
if [ -n "$CI" ]; then
  functions config set watch false
  functions restart
fi
export DEPLOY_OUTPUT_FILE=`mktemp`
functions deploy api --trigger-http | tee $DEPLOY_OUTPUT_FILE
export API_URL=`grep Resource $DEPLOY_OUTPUT_FILE | grep -o 'http://localhost:[^[:space:]]*'`
echo API_URL=$API_URL

## Smoke test API endpoint
curl --silent $API_URL/ping
echo

## Run Postman tests against local deployed API
echo "Using newman runner located at: ["`which newman`"]"
newman run ./api-tests.postman.json --global-var "apiUrl=$API_URL"
