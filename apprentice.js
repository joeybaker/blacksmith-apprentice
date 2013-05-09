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
              'author': val.author + ' Baker',
              'date': new Date(val.date * 1000).toISOString(),
              'summary': val.summary.replace(/\r|\n/g, ''),
              'dsqId': val.dsq
            }
            , metadata = '\n\n'
            , content


          for (var key in meta){
            if (meta[key]) metadata += '[meta:' + key + ']: <> (' + meta[key] + ')\n'
          }

          // cleanup the content
          content = val.body
            // WP has custom "caption" elements, we'll turn those into <figure>
            .replace(/\[caption(.*) caption\=\"(.*)\"\](.*)\[\/caption\]/g, '<figure>$3<figcaption>$2</figcaption></figure>')
            // convert to Blacksmith's truncate syntax
            .replace(/<\!--more-->/g, '\n\n##!!truncate\n\n')
            // kill empty paragraphs
            .replace(/<p><\/p>/g, '').replace(/<p>\&nbsp;<\/p>/g, '')
            // the zemanta plugin leaves crap behind
            .replace(/<div class\=\"zemanta\-pixie\"(.*)/g, '').replace(/\n<\/span><\/div>/g, '')
            // append a new line to closing tags to make it clear to HTML parsers what's going on
            .replace(/<\/(\w+)>/g, '</$1>\n')
            // tabs cause markdown to get confused
            .replace(/\t/g, '')
            // add the metadata
            + metadata


          // if (/\[caption(.*) caption\=\"(.*)\"\](.*)\[\/caption\]/.test(content)) console.log(meta.title, content)
          // console.log(content.indexOf('<!--more-->') ? 'has more' : null)

          fs.writeFile('./posts/' + fileName + '.md', content, function (err) {
            if (err) throw err
          })
        })
      })
      client.end()
    })
  })

}
