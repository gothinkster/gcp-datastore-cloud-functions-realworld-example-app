const User = require('./User.js');
const Article = require('./Article.js');
const expect = require('chai').expect;
const casual = require('casual');
const mlog = process.env.CI ? { log() {} } : require('mocha-logger');

let authorUser = null;
let readerUser = null;
let createdArticle = null;
let createdArticleNoTags = null;
let createdComment = null;

const expectedArticleKeys = ['slug', 'title', 'description', 'body', 'tagList',
  'createdAt', 'updatedAt', 'favorited', 'favoritesCount', 'author'
].sort();
const expectedArticleAuthorKeys = ['username', 'image', 'bio', 'following'].sort();
const expectedCommentKeys = ['id', 'createdAt', 'updatedAt', 'body', 'author'].sort();
const expectedCommentAuthorKeys = expectedArticleAuthorKeys;
const expectedTags = [];

describe('Article module', async () => {

  before(async () => {
    await cleanSlate();
    await delay(1000);

    const authorUsername = 'author_' + casual.username;
    authorUser = await User.create({
      email: authorUsername + '@mail.com',
      username: authorUsername,
      password: 'a',
    });

    const readerUsername = 'reader_' + casual.username;
    readerUser = await User.create({
      email: readerUsername + '@mail.com',
      username: readerUsername,
      password: 'a',
    });
  });

  after(async () => {
    await cleanSlate();
  });

  it('should create new article', async () => {
    createdArticle = await Article.create({
      title: casual.title,
      description: casual.description,
      body: casual.text,
      tagList: casual.array_of_words(Math.ceil(10 * Math.random())),
    }, authorUser.username);
    expectArticleSchema(createdArticle);
    expectedTags.push(...createdArticle.tagList);

    // TODO: Assert on Article fields
    mlog.log(`Created article: [${JSON.stringify(createdArticle)}]`);
  });

  it('should create new article wihtout tags', async () => {
    createdArticleNoTags = await Article.create({
      title: casual.title,
      description: casual.description,
      body: casual.text,
    }, authorUser.username);
    expectArticleSchema(createdArticleNoTags);
    expect(createdArticleNoTags.tagList).to.be.an('array').that.is.empty;
  });

  it('should update article', async () => {
    const newTitle = casual.title;
    const newDescription = casual.description;
    const newBody = casual.text;
    let updatedArticle = await Article.update(createdArticle.slug, {
      title: newTitle,
      description: newDescription,
      body: newBody,
    }, authorUser.username);
    mlog.log(`Updated article: [${JSON.stringify(updatedArticle)}]`);
    expect(updatedArticle.title).to.equal(newTitle);
    expect(updatedArticle.description).to.equal(newDescription);
    expect(updatedArticle.body).to.equal(newBody);

    // Verify empty mutation is a no-op
    updatedArticle = await Article.update(createdArticle.slug, {}, authorUser.username);
    expect(updatedArticle.title).to.equal(newTitle);
    expect(updatedArticle.description).to.equal(newDescription);
    expect(updatedArticle.body).to.equal(newBody);

    await Article.update(casual.word).catch(err =>
      expect(err).to.match(/Article not found/));
    await Article.update(createdArticle.slug, casual.username).catch(err =>
      expect(err).to.match(/Only author can update article/));

  });

  it('should not allow unknown author', async () => {
    await Article.create(null, casual.username).catch(err =>
      expect(err).to.match(/User does not exist/));
  });

  it('should get existing article anonymously', async () => {
    const retrievedArticle = await Article.get(createdArticle.slug);
    expectArticleSchema(retrievedArticle);
    expect(retrievedArticle.author.following).to.be.false;
  });

  it('should favorite/unfavorite article', async () => {
    let favoritedArticle = await Article.favoriteArticle(createdArticle.slug, readerUser.username);
    expectArticleSchema(favoritedArticle);
    expect(favoritedArticle.favorited).to.be.true;
    expect(favoritedArticle.favoritesCount).to.equal(1);

    // Delay a little before asserting on favoritedBy
    await delay(2000);
    const favoritedArticles = await Article.getAll({ favoritedBy: readerUser.username });
    expect(favoritedArticles).to.be.an('array').to.have.lengthOf(1);
    expectArticleSchema(favoritedArticles[0]);

    favoritedArticle = await Article.unfavoriteArticle(createdArticle.slug, readerUser.username);
    expectArticleSchema(favoritedArticle);
    expect(favoritedArticle.favorited).to.be.false;
    expect(favoritedArticle.favoritesCount).to.equal(0);

    await Article.favoriteArticle('unknown_slug_' + casual.title, readerUser.username).catch(err =>
      expect(err).to.match(/Article does not exist/));
    await Article.favoriteArticle(createdArticle.slug).catch(err =>
      expect(err).to.match(/User must be specified/));
    await Article.favoriteArticle(createdArticle.slug, 'unknown_username_' + casual.username).catch(err =>
      expect(err).to.match(/User does not exist/));
  });

  it('should get article by followed author', async () => {
    await User.followUser(readerUser.username, authorUser.username);
    const retrievedArticle = await Article.get(createdArticle.slug, readerUser.username);
    expectArticleSchema(retrievedArticle);
    mlog.log(`Retrieved article: [${JSON.stringify(retrievedArticle)}]`);
    expect(retrievedArticle.author.following).to.be.true;
  });

  it('should get article by unfollowed author', async () => {
    await User.unfollowUser(readerUser.username, authorUser.username);
    const retrievedArticle = await Article.get(createdArticle.slug, readerUser.username);
    expectArticleSchema(retrievedArticle);
    expect(retrievedArticle.author.following).to.be.false;
  });

  it('should error on unknown article', async () => {
    await Article.get(casual.password).catch(err =>
      expect(err).to.match(/Article not found/));
  });

  it('should error on unknown reader', async () => {
    await Article.get(createdArticle.slug, casual.password).catch(err =>
      expect(err).to.match(/User does not exist/));
  });

  it('should get all articles', async () => {
    const articles = await Article.getAll();
    expect(articles).to.be.an('array');
    articles.forEach(expectArticleSchema);
    // TODO: Assert on retrieved articles
  });

  it('should get all articles by tag', async () => {
    const articles = await Article.getAll({ tag: createdArticle.tagList[0] });
    articles.forEach(expectArticleSchema);
    expect(articles[0].tagList).to.contain(createdArticle.tagList[0]);
  });

  it('should get all articles by author', async () => {
    const articles = await Article.getAll({ author: authorUser.username });
    articles.forEach(expectArticleSchema);
    expect(articles[0].author.username).to.equal(authorUser.username);
  });

  it('should get all articles with limit/offset', async () => {
    // Create few more articles for pagination
    process.stdout.write('      ');
    for (let i = 1; i <= 10; ++i) {
      process.stdout.write('.');
      await Article.create({
        title: i,
        description: `description ${i}`,
        body: `body ${i}`,
        tagList: ['sometag', `tag${i}`],
      }, authorUser.username);
      expectedTags.push(`tag${i}`);
      await delay(100);
    }
    expectedTags.push('sometag');
    console.log('');

    let articles = await Article.getAll({ limit: 3 });
    articles.forEach(expectArticleSchema);
    expect(articles).to.be.an('array').to.have.lengthOf(3);

    articles = await Article.getAll({ offset: 3 });
    articles.forEach(expectArticleSchema);
    expect(articles).to.be.an('array').to.have.lengthOf(9);

    articles = await Article.getAll({ offset: 100 });
    expect(articles).to.be.an('array').to.have.lengthOf(0);
  });

  it('should get all articles with a reader', async () => {
    const articles = await Article.getAll({ reader: 'foobar' });
    expect(articles).to.be.an('array');
    articles.forEach(expectArticleSchema);
    // TODO: Assert on retrieved articles
  });

  it('should get feed', async () => {
    // Create a second user to follow
    const secondAuthorUser = await User.create({
      username: 'second_author',
      email: 'second_author@gmail.com',
      password: 'a',
    });
    await Article.create({
      title: 'second_author_article',
      description: 'foo',
      body: 'bar'
    }, secondAuthorUser.username);
    await User.followUser(readerUser.username, secondAuthorUser.username);
    await User.followUser(readerUser.username, authorUser.username);
    let feed = await Article.getFeed(readerUser.username);
    feed.forEach(expectArticleSchema);
    expect(feed).to.be.an('array').to.have.lengthOf(13);
    expect(feed[0].author.username).to.equal('second_author');
    expect(feed[0].title).to.equal('second_author_article');
    for (const article of feed.slice(1)) {
      expect(article.author.username).to.equal(authorUser.username);
    }

    // Verify order of feed is descending by createdAt
    for (let i = 0; i < feed.length - 1; ++i) {
      expect(feed[i].createdAt).to.be.above(feed[i + 1].createdAt);
    }

    // Unfollow first author, end expect only second author's article
    await User.unfollowUser(readerUser.username, authorUser.username);
    feed = await Article.getFeed(readerUser.username);
    feed.forEach(expectArticleSchema);
    expect(feed).to.be.an('array').to.have.lengthOf(1);

    await Article.getFeed('non-existent_username_' + casual.username).catch(err => {
      expect(err).to.match(/User not found/);
    });
  });

  it('should get feed with limit/offset', async () => {
    await User.followUser(readerUser.username, authorUser.username);
    let feed = await Article.getFeed(readerUser.username, { limit: 3 });
    feed.forEach(expectArticleSchema);
    expect(feed).to.be.an('array').to.have.lengthOf(3);
    feed = await Article.getFeed(readerUser.username, { limit: 4, offset: 2 });
    feed.forEach(expectArticleSchema);
    expect(feed).to.be.an('array').to.have.lengthOf(4);
  });

  it('should delete article', async () => {
    await Article.delete(createdArticleNoTags.slug + casual.word, authorUser.username).catch(err =>
      expect(err).to.match(/Article not found/));
    await Article.delete(createdArticleNoTags.slug, authorUser.username + casual.word).catch(err =>
      expect(err).to.match(/User does not exist/));
    await Article.delete(createdArticleNoTags.slug, readerUser.username).catch(err =>
      expect(err).to.match(/Only author can delete article/));

    await Article.delete(createdArticleNoTags.slug, authorUser.username);
  });

  it('should get tags', async () => {
    const tags = await Article.getAllTags();
    expect(tags).to.be.an('array');
    expect(tags.length).to.be.at.least(11);
    // TODO: Fix tags assertion
    // expect(tags).to.have.members(expectedTags);
  });

  it('should create new comment', async () => {
    const commentBody = casual.sentence;
    createdComment = await Article.createComment(createdArticle.slug, authorUser.username, commentBody);
    expectCommentSchema(createdComment);
    mlog.log(`Created comment: [${JSON.stringify(createdComment)}]`);
    // TODO: Assert on created comment
  });

  it('should get all comments', async () => {
    const createdComments = [];
    process.stdout.write('      ');
    for (let i = 1; i <= 10; ++i) {
      process.stdout.write('.');
      createdComments.push(await Article.createComment(createdArticle.slug, authorUser.username, `comment ${i}`));
      await delay(100);
    }
    console.log('');
    let retrievedComments = await Article.getAllComments(createdArticle.slug);
    retrievedComments.forEach(expectCommentSchema);
    expect(retrievedComments, JSON.stringify(retrievedComments)).to.be.an('array').to.have.lengthOf(11);
    // Verify comments are in reverse chronological order (newest first)
    for (let i = 0; i < retrievedComments.length - 1; ++i) {
      expect(retrievedComments[i].createdAt).to.be.above(retrievedComments[i + 1].createdAt);
    }

    // Verify following bit is set correctly
    await User.followUser(readerUser.username, authorUser.username);
    retrievedComments = await Article.getAllComments(createdArticle.slug, readerUser.username);
    retrievedComments.forEach(expectCommentSchema);
    for (let i = 0; i < retrievedComments.length; ++i) {
      expect(retrievedComments[i].author.following).to.be.true;
    }
  });

  it('should delete a comment', async () => {
    await Article.deleteComment(createdArticle.slug, createdComment.id + 10, authorUser.username)
      .catch(err => expect(err).to.match(/Comment not found/));
    await Article.deleteComment(createdArticle.slug, createdComment.id, casual.username)
      .catch(err => expect(err).to.match(/Only comment author can delete comment/));
    await Article.deleteComment(createdArticle.slug, createdComment.id, authorUser.username);
  });

});

function delay(time) {
  return new Promise((fulfill) => setTimeout(fulfill, time));
}

async function cleanSlate() {
  mlog.log('Deleting all users.');
  await User.testutils.__deleteAllUsers();
  mlog.log('Deleting all articles.');
  await Article.testutils.__deleteAllArticles();
  mlog.log('Deleting all comments.');
  await Article.testutils.__deleteAllComments();
}

function expectArticleSchema(aArticle) {
  expect(Object.keys(aArticle).sort()).to.eql(expectedArticleKeys);
  expect(Object.keys(aArticle.author).sort()).to.eql(expectedArticleAuthorKeys);
}

function expectCommentSchema(aComment) {
  expect(Object.keys(aComment).sort()).to.eql(expectedCommentKeys);
  expect(Object.keys(aComment.author).sort()).to.eql(expectedCommentAuthorKeys);
}
