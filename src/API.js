const Router = require('./Router.js');

module.exports = {

  // Top level entry point
  async api(req, res) {
    res.setHeader('Content-Type', 'application/json');
    try {
      await Router.route(req, res);
    } catch (e) {
      console.log(e);
      res.status(422).send({ errors: { body: [e.message], } });
    }
  }

};
