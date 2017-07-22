var app = require('../../server/server')

module.exports = function(team) {

  team.selectFavorite = function (ctx, clientId, teamId, cb) {
		var client = app.models.client
		client.findById(clientId, function(err, clientInst) {
			if (err)
				return cb(err)
			if (ctx.req.accessToken.userId !== clientId)
				return cb(new Error('Owner Error'))
			team.findById(teamId, function(err, teamInst) {
				if (err)
					return cb(err)
				teamInst.clients.add(clientInst, function(err, result) {
					if (err)
						return cb(err)
					return cb(result)
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
        source: 'query'
      },
    }, {
      arg: 'teamId',
      type: 'string',
      http: {
        source: 'query'
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
      type: 'string',
      root: true
    }
  })

}
