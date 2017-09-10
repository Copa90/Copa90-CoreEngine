var utility = require('../../public/utility.js')

var CONTAINERS_URL = 'containers/'

var fs = require('fs')
var path = require('path')

var app = require('../../server/server')

var jdenticon = require("jdenticon")

module.exports = function(container) {

	function writeDataInClientModel(clientId, profilePath, cb) {
		var client = app.models.client
		client.findById(clientId.toString(), function(err, clientInst) {
			if (err)
				return cb(err)
      if (!clientInst)
        return cb(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			clientInst.updateAttribute('profilePath', profilePath, function(err, result) {
				if (err)
					return cb(err)
				return cb(null, result)
			})
		})
	}

	container.uploadSampleProImage = function(clientId, cb) {
		var size = 200
		var png = jdenticon.toPng('' + clientId.toString(), size);

		var directory = path.resolve(__dirname + '/../../fileStorage/')
		var fp = directory + '/' + clientId.toString() + '/profile.png'
		var fileURL = CONTAINERS_URL + clientId.toString() + '/download/profile.png'

    fs.writeFile(fp, png, function (err) {
      if (err)
        return cb(err, null)
			writeDataInClientModel(clientId.toString(), fileURL, function(err, result) {
				if (err)
					return cb(err, null)
				return cb(null, 'successfuly added sample image')
			})
    })
	}

  container.remoteMethod('uploadSampleProImage', {
    accepts: [{
      arg: 'clientId',
      type: 'string',
      http: {
        source: 'path'
      }
    }],
    description: 'upload a sample image with jdenticon',
    http: {
      path: '/uploadSampleProImage/:clientId',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'string',
      root: true
    }
  })

	container.regenrateSampleProImage = function(cb) {
    var client = app.models.client
    client.find({where:{phoneNumber:{neq: '09120001122'}}}, function(err, clientList) {
      if (err)
        return cb(err)
      var counter = 0
      for (var i = 0; i < clientList.length; i++) {
        var model = clientList[i]
        var directory = path.resolve(__dirname + '/../../fileStorage/')
        var fp = directory + '/' + model.id.toString() + '/profile.png'
        var option = {}
        option.name = '' + model.id.toString()
        container.createContainer(option, function (err, res) {
          if (err)
            return cb(err)
          console.log(JSON.stringify(res))
          container.uploadSampleProImage(res.name.toString(), function(err, result) {
            if (err)
              return cb(err)
            counter++
            if (counter == clientList.length)
              return cb(null, 'successfully regenerated')
          })
        })          
      }
    })
	}

  container.remoteMethod('regenrateSampleProImage', {
    accepts: [],
    description: 'regenrate a sample image with jdenticon',
    http: {
      path: '/regenrateSampleProImage',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'string',
      root: true
    }
  })

}
