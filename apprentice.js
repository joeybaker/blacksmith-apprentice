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

        var dir_title = val.title.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-');

        mkdirp('./output/' + dirTitle, function (err) {
          if (err) throw err

          var page = {
            'title': val.title,
            'author': val.author,
            'date': new Date(val.date * 1000).toISOString(),
          }


          page = JSON.stringify(page)

          var content = val.body.replace('<!--more-->', '##')

          fs.writeFile('./output/' + dirTitle + '/content.md', content, function (err) {
            if (err) throw err
            fs.writeFile('./output/' + dirTitle + '/page.json', page, function (err) {
              if (err) throw err
            })
          })
        })
      })
      client.end()
    })
  })

}
