var cron = require('cron')
var app = require('../../server/server')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/predictStatus.json')
var tagConfig = require('../../config/predictTags.json')
var estimateStatusConfig = require('../../config/estimateStatus.json')

module.exports = function(predict) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	predict.validatesInclusionOf('status', {in: statusList})

  var tagsList = []
  for (var key in tagConfig) 
    tagsList.push(tagConfig[key])

	predict.validatesInclusionOf('tag', {in: tagsList})

	function finishPredict(predictInstance, cb) {
		predictInstance.estimates({'status': estimateStatusConfig.open}, function(err, estimateList) {
			if (err)
				return cb(err)
			var time = utility.getUnixTimeStamp()
			for (var i = 0; i < estimateList.length; i++) {
				var status = estimateStatusConfig.lose
				if (ctx.args.data.occurrence == 1)
					status = estimateStatusConfig.win
				estimateList[i].updateAttributes({'status': status, 'checkTime': time}, function(err, updateInstance) {
					if (err)
						return cb(err)
					if (ctx.args.data.occurrence == 1) {
						updateInstance.client(function(err, clientInst) {
							if (err)
								return cb(err)
							var newRoundWins = clientInst.accountInfoModel.roundWins + 1
							var newTotalPoints = client.accountInfoModel.totalPoints + predictInstance.point
							clientInst.accountInfo.update({'roundWins': newRoundWins, 'totalPoints': newTotalPoints}, function(err, accountInst) {
								if (err)
									return cb(err)
								var ranking = app.models.ranking
								ranking.find({'where':{'clientId': clientInst.id}}, function(err, rankingList) {
									if (err)
										return cb(err)
									for (var j = 0; j < rankingList.length; j++) {
										var innerPoints = rankingList[j].points + predictInstance.point
										rankingList[j].updateAttribute('points', innerPoints, function(err, res) {
											if (err)
												return cb(err)
											if (j == rankingList.length) {
												var competition = app.models.competition
												competition.find({'where':{'clientId': clientInst.id}}, function(err, competitionList) {
													if (err)
														return cb(err)
													for (var j = 0; j < competitionList.length; j++) {
														var innerPoints = competitionList[j].points + predictInstance.point
														competitionList[j].updateAttribute('points', innerPoints, function(err, res) {
															if (err)
																return cb(err)
															if (i == estimateList.length) {
																var sequencer = app.models.sequencer
																sequencer.resetAll(function(err, result) {
																	if (err)
																		return cb(err)
																	return cb(null)
																})
															}
														})
													}
												})
											}
										})
									}
								})
							})
						})
					}
					else {
						return cb(null)
					}
				})
			}					
		})
	}

	var startPredicts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		predict.find({
			where: {
				'status': statusConfig.created
			}
		}, function (err, predictList) {
			if (err)
				console.error(err)
			for (var i = 0; i < predictList.length; i++) {
				if (predictList[i].beginningTime <= time && predictList[i].endingTime >= time) {
					predictList[i].updateAttribute('status', statusConfig.working, function (err, predictInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	var finishPredicts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		predict.find({
			where: {
				'status': statusConfig.working
			}
		}, function (err, predictList) {
			if (err)
				console.error(err)
			for (var i = 0; i < predictList.length; i++) {
				if (predictList[i].endingTime <= time) {
					predictList[i].updateAttribute('status', statusConfig.finished, function (err, predictInst) {
						if (err)
							console.error(err)
						finishPredict(predictInst, function(err, result) {
							if (err)
								console.error(err)
						})
					})
				}
			}
		})
	})

	startPredicts.start()
	finishPredicts.start()

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
			modelInstance.updateAttribute('status', statusConfig.finished, function(err, predictInstance) {
				if (err)
					return next(err)
				finishPredict(predictInstance, function(err, result) {
					if (err)
						return next(err)
					return next()
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
