# ![](logo.png)

[![RealWorld Backend](https://img.shields.io/badge/realworld-backend-%23783578.svg)](http://realworld.io)
[![TravisCI](https://img.shields.io/travis/gothinkster/gcp-datastore-cloud-functions-realworld-example-app/master.svg)](https://travis-ci.org/gothinkster/gcp-datastore-cloud-functions-realworld-example-app)
[![Coverage Status](https://coveralls.io/repos/github/gothinkster/gcp-datastore-cloud-functions-realworld-example-app/badge.svg?branch=master)](https://coveralls.io/github/gothinkster/gcp-datastore-cloud-functions-realworld-example-app?branch=master)
[![Docs](https://img.shields.io/badge/docs-Postman-brightgreen.svg)](https://documenter.getpostman.com/view/1841370/realworld-api/7TFGFZA)
[![dependencies Status](https://david-dm.org/gothinkster/gcp-datastore-cloud-functions-realworld-example-app/status.svg)](https://david-dm.org/gothinkster/gcp-datastore-cloud-functions-realworld-example-app)
[![Known Vulnerabilities](https://snyk.io/test/github/gothinkster/gcp-datastore-cloud-functions-realworld-example-app/badge.svg)](https://snyk.io/test/github/gothinkster/gcp-datastore-cloud-functions-realworld-example-app)

> ### Google Cloud Platform (Datastore + Cloud Functions) serverless codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the [RealWorld API Spec](https://github.com/gothinkster/realworld/tree/master/api).

This codebase was created to demonstrate a fully fledged fullstack application built with **Google Cloud Platform (Datastore + Cloud Functions)** including CRUD operations, authentication, routing, pagination, and more.

We've gone to great lengths to adhere to community style guides & best practices.

For more information on how to this works with other frontends/backends, head over to the [RealWorld](https://github.com/gothinkster/realworld) repo.

# How it works

## Background

This codebase is meant to be deployed to [Google Cloud Functions](https://cloud.google.com/functions/), a serverless environment which allows you to run NodeJS code in response to events like [HTTP triggers](https://cloud.google.com/functions/docs/calling/http) scaling up and down elastically without the need for spinning up or maintaining servers.

## Life of a Request

For every [API](https://github.com/gothinkster/realworld/blob/master/api/README.md) call made, a new invocation of the top level function [`index.js`](index.js) occurs. It calls [`Router.js`](src/Router.js) which parses the HTTP route and calls the appropriate handler in [`User.js`](src/User.js) or [`Article.js`](src/Article.js). The handler applies business logic and returns a response which is marshalled back to the caller by Cloud Functions.

For data persistence, [Google Cloud Datastore](https://cloud.google.com/datastore/docs/concepts/overview) is used which is a fully managed NoSQL database as a service. Cloud Datastore [multitenancy](https://cloud.google.com/datastore/docs/concepts/multitenancy) is supported and can be leveraged by specifying a `DATASTORE_NAMESPACE` environment variable at runtime.

## Datastore Schema

### User

```javascript
{ username: 'Julie_Stracke',
  password: '$2a$05$Unbla43FRv5Zb...',
  email: 'Julie_Stracke@foomail.com',
  image: '',
  bio: '',
  followers: [],
  following: [],
  [Symbol(KEY)]:
   Key {
     namespace: 'test-unit',
     name: 'Julie_Stracke',
     kind: 'User',
     path: [Getter] } }
```

### Article

```javascript

{ slug: 'In-enim-nur2bx',
  title: 'In enim',
  description: 'Suscipit voluptas minima...',
  body: 'Voluptates doloremque unde...',
  tagList: [ 'temporibus', 'quae', 'omnis', 'aut' ],
  createdAt: 1509036552780,
  updatedAt: 1509036552780,
  author: 'author_Paul_Heaney',
  favoritedBy: [],
  [Symbol(KEY)]:
   Key {
     namespace: 'test-unit',
     name: 'In-enim-nur2bx',
     kind: 'Article',
     path: [Getter] } }
```

### Comment

```javascript
{ body: 'Voluptatem dolorem repellat...',
  author: 'Wiegand_Hattie',
  createdAt: 1509036740596,
  updatedAt: 1509036740596,
  [Symbol(KEY)]:
   Key {
     namespace: 'test-unit',
     id: '5629499534213120',
     kind: 'Comment',
     parent:
      Key {
        namespace: 'test-unit',
        name: 'In-enim-nur2bx',
        kind: 'Article',
        path: [Getter] },
     path: [Getter] } }
```


## Testing

### Unit Tests
Unit tests live adjacent to source code as [`src/*.test.js`](src/) and can be run by executing `npm run test:unit`. They use [mocha](https://mochajs.org) as a test runner and [istanbul/nyc](https://istanbul.js.org) for coverage.

### API Tests
You can also run Postman based [API tests](api-tests.postman.json) by executing `npm run test:api`. These are run using the [newman](https://github.com/postmanlabs/newman) command line runner. The code is deployed locally to a [Cloud Functions Local Emulator](https://cloud.google.com/functions/docs/emulator) environment and tested. See [`run-api-tests.sh`](run-api-tests.sh) for details.

### Linting
Code linting is enforced using `eslint` configured by [`.eslintrc.js`](.eslintrc.js). You can run the linter by executing `npm run lint`.

### CI
Continuous integration is performed by [TravisCI](https://travis-ci.org/gothinkster/gcp-datastore-cloud-functions-realworld-example-app). See [`.travis.yml`](.travis.yml) for details.

### CD
If all tests pass, the code is automatically deployed to a [Cloud Functions Endpoint](https://us-central1-realworld-datastore.cloudfunctions.net/api/articles). See [deploy-to-cloud.sh](deploy-to-cloud.sh) for details.

# Getting started

## Setup Google Cloud Platform (GCP)

* Signup for a Google Cloud Platform (GCP) Free Account [here](https://cloud.google.com/free/) and create a new project
* Setup Cloud Datastore for this project by following steps [here](https://cloud.google.com/datastore/docs/quickstart)
* Install and setup `gcloud` CLI tool by following help [here](https://cloud.google.com/sdk/downloads)

## Setup local development environment

*Note: Node.js 8.0 or greater is required*

* Clone this repo
* Create GCP Datastore indexes
```
gcloud datastore indexes create index.yaml
```
* Create a [service account](https://cloud.google.com/compute/docs/access/service-accounts) and store the credentials as `service-account-key.json` in the repo root folder - DO NOT SHARE THIS FILE!
* Ensure Datastore indexes are created before proceeding by checking [here](https://console.cloud.google.com/datastore/indexes)
* Specify details about your GCP project,
```
export GOOGLE_APPLICATION_CREDENTIALS=service-account-key.json
export GCP_PROJECT_ID=<your-GCP-project-id>
```
* Install dependencies
```
npm install
```
* Setup [Cloud Functions Local Emulator](https://cloud.google.com/functions/docs/emulator)
```
npx functions config set projectId $GCP_PROJECT_ID
```

* Test
```
npm test
```

## Deploy to Cloud Functions
```
npm run deploy
```

More details in [deploy-to-cloud.sh](deploy-to-cloud.sh).
