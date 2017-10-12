const User = require('./User.js');

module.exports = {

  async route(req, res) {

    var validatedUser = null; // eslint-disable-line no-var
    const token = req.get('Authorization');
    if (token) {
      validatedUser = await User.authenticateToken(token);
    }

    if (req.path == '/ping') {
      res.status(200).send({ pong: new Date(), DATASTORE_NAMESPACE: process.env.DATASTORE_NAMESPACE, });
    } else if (req.method == 'POST' && req.path == '/users') {
      res.status(200).send({ user: await User.create(req.body.user) });
    } else if (req.method == 'POST' && req.path == '/users/login') {
      res.status(200).send({ user: await User.login(req.body.user) });
    } else if (req.method == 'GET' && req.path == '/user') {
      if (!validatedUser) {
        res.status(401).send({ errors: { body: ['Token is required'], }, });
      }
      res.status(200).send({ user: validatedUser });
    } else {
      res.status(404).send({ errors: { body: [`404 Not found: [${req.method} ${req.path}]`], }, });
    }

  },

};
