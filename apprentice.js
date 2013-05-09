'use strict';
var mysql  = require('mysql')
  , events = require('events')
  , mkdirp = require('mkdirp')
  , fs     = require('fs')
  , migrateSteps = new events.EventEmitter()
  , migration = {}

migrateSteps.on('dbConfig', function () {
  console.log('database configured...\n')
  migration.createQuery()
})

migrateSteps.on('query_ready', function () {
  migration.migrate()
})

migration.configureDb = function () {
  fs.readFile('config.json', 'utf8', function (err, data) {
    if (err) throw err
    var config
    try {
      config = JSON.parse(data)
    }
    catch (e) {
      console.error('error parsing config.json \n\n' + e)
    }

    migration.dbConfig = config
    migrateSteps.emit('dbConfig', config)
  })
}

migration.createQuery = function () {
  fs.readFile('blogs.json', 'utf8', function (err, data) {
    if (err) throw err
    var blogs

    try {
      blogs = JSON.parse(data)
    }
    catch (e) {
      console.error('error parsing blogs.json \n\n' + e)
    }

    migration.query = blogs[migration.dbConfig.engine].replace(/\[PREFIX\]/g, migration.dbConfig.tablePrefix)
    migrateSteps.emit('query_ready', migration.query)

  })

}

migration.configureDb()

migration.migrate = function () {

  var client = mysql.createClient({
    user: migration.dbConfig.dbUser,
    password: migration.dbConfig.dbPass,
  })

  client.query('use ' + migration.dbConfig.dbName, function (err) {
    if (err) throw err

    client.query(migration.query, function (err, res) {
      if (err) throw err

      res.forEach (function (val) {

        var fileName = val.dir

        mkdirp('./posts/', function (err) {
          if (err) throw err

          var meta = {
            'title': val.title,
            'author': val.author,
            'date': new Date(val.date * 1000).toISOString(),
            'summary': val.summary.replace('\n', ''),
            'dsqId': val.dsq
          }
          , metadata = '\n\n'

          for (var key in meta){
            if (meta[key]) metadata += '[meta:' + key + ']: <> (' + meta[key] + ')\n'
          }

          var content = val.body.replace('<!--more-->', '\n\n##!!truncate\n\n') + metadata

          fs.writeFile('./posts/' + fileName + '.md', content, function (err) {
            if (err) throw err
          })
        })
      })
      client.end()
    })
  })

}
