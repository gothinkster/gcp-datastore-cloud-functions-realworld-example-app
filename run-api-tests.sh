#!/bin/bash -x
pwd

## Deploy to Cloud Functions Local Emulator
export DATASTORE_NAMESPACE=test-api
which functions
echo $GCP_PROJECT | functions start
if [ -n "$CI" ]; then
  functions config set watch false
  functions restart
fi
export DEPLOY_OUTPUT_FILE=`mktemp`
functions deploy api --trigger-http | tee $DEPLOY_OUTPUT_FILE
export API_URL=`grep Resource $DEPLOY_OUTPUT_FILE | grep -o 'http://localhost:[^[:space:]]*'`
echo $API_URL

## Smoke test API endpoint
curl $API_URL/ping | python -m json.tool

## Run Postman tests against local deployed API
which newman
newman run --global-var="apiUrl=$API_URL" --folder automated ./api-tests.postman.json
