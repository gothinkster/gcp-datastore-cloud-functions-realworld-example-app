module.exports = {

  async route(req, res) {

    if (req.path == '/ping') {
      res.status(200).send({ pong: new Date(), });
    } else {
      res.status(404).send({ errors: { body: [`404 Not found: [${req.method} ${req.path}]`], }, });
    }

  },

};
