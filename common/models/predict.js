var app = require('../../server/server')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/predictStatus.json')
var estimateStatusConfig = require('../../config/estimateStatus.json')

module.exports = function(predict) {

  predict.afterRemote('create', function (ctx, modelInstance, next) {
		var league = app.models.league
		league.findById(ctx.args.data.leagueId, function(err, leagueInst) {
			if (err)
				return next(err)
			modelInstance.leagueRel(leagueInst)
			return next()
		})
	})

  predict.afterRemote('replaceById', function (ctx, modelInstance, next) {
		if (ctx.args.data.status === statusConfig.working && (ctx.args.data.occurrence && ctx.args.data.occurrence != 0)) {
			var client = app.models.client
			modelInstance.updateAttribute('status', statusConfig.finished, function(err, instance) {
				if (err)
					return next(err)
				instance.estimates({'status': estimateStatusConfig.open}, function(err, estimateList) {
					if (err)
						return next(err)
					var time = utility.getUnixTimeStamp()
					for (var i = 0; i < estimateList.length; i++) {
						var status = estimateStatusConfig.lose
						if (ctx.args.data.occurrence == 1)
							status = estimateStatusConfig.win
						estimateList[i].updateAttributes({'status': status, 'checkTime': time}, function(err, updateInstance) {
							if (err)
								return next(err)
							if (ctx.args.data.occurrence == 1) {
								updateInstance.client(function(err, clientInst) {
									if (err)
										return next(err)
									var newRoundWins = clientInst.accountInfoModel.roundWins + 1
									var newTotalPoints = client.accountInfoModel.totalPoints + modelInstance.point
									clientInst.accountInfo.update({'roundWins': newRoundWins, 'totalPoints': newTotalPoints}, function(err, accountInst) {
										if (err)
											return next(err)
										if (i == estimateList.length)
											return next()
									})
								})
							}
							else {
								return next()
							}
						})
					}					
				})
			})
		}
		else 
			return next()
	})

	predict.afterRemote('deleteById', function (ctx, modelInstance, next) {
		if (modelInstance.estimates.length > 0) {
			modelInstance.estimates.destroyAll(function(err, result) {
				if (err)
					return next(err)
				return next()
			})
		}
		else 
			return next()
	})
}
