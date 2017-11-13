#!/bin/bash -e

## Transpile code to Node 6 (needed for Cloud Functions)
rm -rf dist/
babel index.js src/*.js --presets es2015,stage-3 --out-dir dist/ --ignore *.test.js

## Setup dist folder with additional files
echo DATASTORE_NAMESPACE=test-api-cloud > dist/.env
cp package.json dist/

## Deploy to Cloud Functions
GCLOUD_BIN="${GCLOUD_BIN:-gcloud}"
$GCLOUD_BIN beta functions deploy api --source=dist/ --trigger-http --stage-bucket=$GCP_PROJECT_ID.appspot.com
export API_URL=`gcloud beta functions describe api --format=text | grep 'httpsTrigger.url:' | grep -o 'https://.*'`
echo API_URL=$API_URL
sleep 5

## Smoke test API endpoint
curl --silent $API_URL/ping
echo

## Run Postman tests against local deployed API
echo "Using newman runner located at: ["`which newman`"]"
newman run --global-var="apiUrl=$API_URL" ./api-tests.postman.json
