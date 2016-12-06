const Promise = require('bluebird')

module.exports.getUsers = () =>
  Promise.delay(5).then(() => ([
    { id: 1, name: 'Jill' },
    { id: 2, name: 'Bob' },
  ]))