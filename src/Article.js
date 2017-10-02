var { ds, namespace } = require('./Datastore.js');
var slug = require('slug');

module.exports = {

  async create(aArticleData, aAuthorUsername) {
    // Get author data
    var authorUser = (await ds.get(ds.key({ namespace, path: ['User', aAuthorUsername] })))[0];
    if (!authorUser) {
      throw new Error(`User does not exist: [${aAuthorUsername}]`);
    }
    ['email', 'password', 'following', 'followers', ds.KEY].forEach(key => delete authorUser[key]);
    authorUser.following = false;

    var articleSlug = slug(aArticleData.title) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
    var timestamp = (new Date()).getTime();
    var newArticle = {
      slug: articleSlug,
      title: aArticleData.title,
      description: aArticleData.description,
      body: aArticleData.body,
      tagList: aArticleData.tagList ? aArticleData.tagList : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      author: aAuthorUsername,
      favoritesCount: 0,
    };
    await ds.upsert({
      key: ds.key({ namespace, path: ['Article', newArticle.slug] }),
      data: newArticle,
    });
    newArticle.author = authorUser;
    newArticle.favorited = false;
    return newArticle;
  },

  async get(aSlug, aReaderUsername) {
    var article = (await ds.get(ds.key({ namespace, path: ['Article', aSlug] })))[0];
    if (!article) {
      throw new Error(`Article not found: [${aSlug}]`);
    }
    delete article[ds.KEY];

    // Get author data
    var authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
    /* istanbul ignore next */
    if (!authorUser) {
      throw new Error(`User does not exist: [${aAuthorUsername}]`);
    }
    ['email', 'password', 'following', ds.KEY].forEach(key => delete authorUser[key]);

    // If reader's username is provided, populate following bit
    authorUser.following = false;
    if (aReaderUsername) {
      authorUser.following = authorUser.followers.includes(aReaderUsername)
    }
    delete authorUser.followers;

    article.author = authorUser;
    return article;
  },

  async getAll(options) {
    var query = ds.createQuery(namespace, 'Article')
      .order('createdAt', { descending: true });
    if (!options) {
      options = {};
    }

    if (options.tag) {
      query = ds.createQuery(namespace, 'Article')
        .order('createdAt', { descending: true })
        .filter('tagList', '=', options.tag);
    } else if (options.author) {
      query = query.filter('author', '=', options.author);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(20);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    var articles = (await query.run(query))[0];
    for (var article of articles) {
      delete article[ds.KEY];

      // Get author info for this article
      var authorUser = (await ds.get(ds.key({ namespace, path: ['User', article.author] })))[0];
      article.author = {
        username: authorUser.username,
        bio: authorUser.bio,
        image: authorUser.image,
      }
      if (options.reader) {
        article.author.following = authorUser.followers.includes(options.reader);
      }
    }

    return articles;
  },

  testutils: {
    async __deleteAll() {
      var articleKeys = (await ds.createQuery(namespace, 'Article').select('__key__').run())[0];
      articleKeys.forEach(async(articleKey) => {
        await ds.delete(articleKey[ds.KEY]);
      });
    }
  },

};
