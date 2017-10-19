# ![](logo.png)

> ### Google Cloud Platform (Datastore + Cloud Functions) serverless codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the [RealWorld API Spec](https://github.com/gothinkster/realworld/tree/master/api).

This codebase was created to demonstrate a fully fledged fullstack application built with **Google Cloud Platform (Datastore + Cloud Functions)** including CRUD operations, authentication, routing, pagination, and more.

We've gone to great lengths to adhere to community style guides & best practices.

For more information on how to this works with other frontends/backends, head over to the [RealWorld](https://github.com/gothinkster/realworld) repo.

# How it works

# Getting started

## Setup Google Cloud Platform (GCP)

* Signup for a Google Cloud Platform (GCP) Free Account [here](https://cloud.google.com/free/) and create a new project
* Setup Cloud Datastore for this project by following steps [here](https://cloud.google.com/datastore/docs/quickstart)
* Install and setup `gcloud` CLI tool by following help [here](https://cloud.google.com/sdk/downloads)

## Setup local development environment

* Clone this repo
* Create GCP Datastore indexes
```
gcloud datastore create-indexes index.yaml
```
* Create a [service account](https://cloud.google.com/compute/docs/access/service-accounts) and store the credentials as `service-account-key.json` in the repo root folder - DO NOT SHARE THIS FILE!
* Ensure Datastore indexes are created before proceeding by checking [here](https://console.cloud.google.com/datastore/indexes)
* Point to service account credentials
```
export GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json
```
* Install dependencies
```
npm install
```
* Setup [Cloud Functions Local Emulator](https://cloud.google.com/functions/docs/emulator)
```
npx functions config set projectId $YOUR_GCP_PROJECT_ID
```
* Test
```
npm test
```
