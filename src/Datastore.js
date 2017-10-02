module.exports = {

  ds: require('@google-cloud/datastore')(),

  namespace: /* istanbul ignore next */ process.env.DATASTORE_NAMESPACE ? process.env.DATASTORE_NAMESPACE : 'dev',

};
