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

}
