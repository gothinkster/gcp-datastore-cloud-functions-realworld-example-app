const routeParser = require('route-parser');
const User = require('./User.js');
const Article = require('./Article.js');

module.exports = {

  async route(req, res) {

    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*')
      .set('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers'));
    if (req.method == 'OPTIONS') {
      res.status(200).send();
      return;
    }

    var validatedUser = null; // eslint-disable-line no-var
    var validatedUsername = null; // eslint-disable-line no-var
    const rawToken = req.get('Authorization');
    if (rawToken) {
      const matchedToken = rawToken.match(/Token (.*)/);
      if (matchedToken && matchedToken[1]) {
        console.log(`matchedToken = ${matchedToken}`);
        validatedUser = await User.authenticateToken(matchedToken[1]);
        validatedUsername = validatedUser.username;
      }
    }

    // Define routes that can be handled
    const routes = [

      // Helpers
      ['GET', '/ping', async () => res.status(200).send({
        pong: new Date(),
        DATASTORE_NAMESPACE: process.env.DATASTORE_NAMESPACE ? process.env.DATASTORE_NAMESPACE : '',
      })],
      ['PURGE', '/__DELETE_ALL_DATA__', async () => {
        await User.testutils.__deleteAllUsers();
        await Article.testutils.__deleteAllArticles();
        await Article.testutils.__deleteAllComments();
        res.status(200).send();
      }],

      // Users
      ['POST', '/users/login', async () => res.status(200).send({ user: await User.login(req.body.user) })],
      ['POST', '/users', async () => res.status(200).send({ user: await User.create(req.body.user) })],
      ['GET', '/user', async () => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Token is required'], }, });
          return;
        }
        res.status(200).send({ user: validatedUser });
      }],
      ['PUT', '/user', async () => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Token is required'], }, });
          return;
        }
        res.status(200).send({ user: await User.update(validatedUser, req.body.user) });
      }],

      // Profiles
      ['GET', '/profiles/:username', async (matchedPath) => res.status(200).send({
        profile: await User.getProfile(matchedPath.username, validatedUser)
      })],
      ['POST', '/profiles/:username/follow', async (matchedPath) => res.status(200).send({
        profile: await User.followUser(validatedUser.username, matchedPath.username)
      })],
      ['DELETE', '/profiles/:username/follow', async (matchedPath) => res.status(200).send({
        profile: await User.unfollowUser(validatedUser.username, matchedPath.username)
      })],

      // Articles
      ['GET', '/articles', async () => {
        const articles = await Article.getAll({
          tag: req.query.tag,
          author: req.query.author,
          favoritedBy: req.query.favorited,
          limit: parseInt(req.query.limit),
          offset: parseInt(req.query.offset),
          reader: validatedUsername,
        });
        res.status(200).send({ articles, articlesCount: articles.length });
      }],
      ['GET', '/articles/feed', async () => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        const articles = await Article.getFeed(validatedUsername, {
          limit: parseInt(req.query.limit),
          offset: parseInt(req.query.offset),
          reader: validatedUsername,
        });
        res.status(200).send({ articles, articlesCount: articles.length });
      }],
      ['POST', '/articles', async () => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        res.status(200).send({ article: await Article.create(req.body.article, validatedUsername) });
      }],
      ['GET', '/articles/:slug', async (matchedPath) => res.status(200).send({
        article: await Article.get(matchedPath.slug, validatedUsername)
      })],
      ['PUT', '/articles/:slug', async (matchedPath) => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        res.status(200).send({ article: await Article.update(matchedPath.slug, req.body.article, validatedUsername) });
      }],
      ['DELETE', '/articles/:slug', async (matchedPath) => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        res.status(200).send(await Article.delete(matchedPath.slug, validatedUsername));
      }],

      // Comments
      ['POST', '/articles/:slug/comments', async (matchedPath) => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        res.status(200).send({
          comment: await Article.createComment(matchedPath.slug, validatedUsername, req.body.comment.body)
        });
      }],
      ['GET', '/articles/:slug/comments', async (matchedPath) => res.status(200).send({
        comments: await Article.getAllComments(matchedPath.slug, validatedUsername)
      })],
      ['DELETE', '/articles/:slug/comments/:id', async (matchedPath) => res.status(200).send(
        await Article.deleteComment(matchedPath.slug, matchedPath.id, validatedUsername))],

      // Favorite/Unfavorite
      ['POST', '/articles/:slug/favorite', async (matchedPath) => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        res.status(200).send({ article: await Article.favoriteArticle(matchedPath.slug, validatedUsername) });
      }],
      ['DELETE', '/articles/:slug/favorite', async (matchedPath) => {
        if (!validatedUser) {
          res.status(401).send({ errors: { body: ['Must be logged in'], }, });
          return;
        }
        res.status(200).send({ article: await Article.unfavoriteArticle(matchedPath.slug, validatedUsername) });
      }],

      // Tags
      ['GET', '/tags', async () => res.status(200).send({ tags: await Article.getAllTags() })],

    ];

    // Match route and call handler
    for (let i = 0; i < routes.length; ++i) {
      const method = routes[i][0];
      const route = routes[i][1];
      const handler = routes[i][2];
      if (req.method !== method) {
        continue;
      }
      const matchedPath = (new routeParser(route)).match(req.path);
      if (matchedPath) {
        await handler(matchedPath);
        return;
      }
    }

    // No routes were matched, respond with 404
    res.status(404).send({ errors: { body: [`404 Not found: [${req.method} ${req.path}]`], }, });

  },

};
