var app = require('../../server/server')

module.exports = function (team) {

  team.validatesUniquenessOf('code', {
    message: 'code is not unique'
  });

  team.selectFavorite = function (ctx, clientId, teamId, cb) {
		var client = app.models.client
    client.findById(clientId, function (err, clientInst) {
      if (err)
				return cb(err)
      team.findById(teamId, function (err, teamInst) {
        if (err)
					return cb(err)
				clientInst.updateAttribute('teamId', teamId, function (err, result) {
					if (err)
						return cb(err)
					return cb(null, result)
				})
      })
    })
  }

  team.remoteMethod('selectFavorite', {
    accepts: [{
      arg: 'ctx',
      type: 'object',
      http: {
        source: 'context'
      }
    }, {
      arg: 'clientId',
      type: 'string',
      http: {
        source: 'path'
      },
    }, {
      arg: 'teamId',
      type: 'string',
      http: {
        source: 'path'
      },
    }],
    description: 'join a client to a particular favorite team',
    http: {
      path: '/:clientId/selectFavorite/:teamId',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })

}
