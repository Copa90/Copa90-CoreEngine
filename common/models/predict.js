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
			if (estimateList.length == 0)
				return cb(null)
			var time = utility.getUnixTimeStamp()
			var counter3 = 0
			for (var i = 0; i < estimateList.length; i++) {
				var status = estimateStatusConfig.lose
				if (predictInstance.occurrence == 1)
					status = estimateStatusConfig.win
				estimateList[i].updateAttributes({'status': status, 'checkTime': time}, function(err, updateInstance) {
					if (err)
						return cb(err)
					if (predictInstance.occurrence == 1) {
						updateInstance.clientRel(function(err, clientInst) {
							if (err)
								return cb(err)
							var newRoundWins = Number(clientInst.accountInfoModel.roundWins) + 1
							var newTotalPoints = Number(clientInst.accountInfoModel.totalPoints) + Number(predictInstance.point)
							clientInst.accountInfo.update({'roundWins': newRoundWins, 'totalPoints': newTotalPoints}, function(err, accountInst) {
								if (err)
									return cb(err)
								var leaguePoint = 0
								if (clientInst.checkpointModel.leagues[predictInstance.leagueId.toString()]) 
									leaguePoint = Number(clientInst.checkpointModel.leagues[predictInstance.leagueId.toString()])
								clientInst.checkpointModel.leagues[predictInstance.leagueId.toString()] = leaguePoint + Number(predictInstance.point)
								clientInst.checkpoint.update({'leagues': clientInst.checkpointModel.leagues}, function(err, result) {
									if (err)
										return cb(err)
									function rankingUpdate(cb1) {
										var ranking = app.models.ranking
										ranking.find({'where':{'clientId': clientInst.id.toString()}}, function(err, rankingList) {
											if (err)
												return cb1(err)
											if (rankingList.length == 0)
												return cb1(null)
											var counter1 = 0
											for (var j = 0; j < rankingList.length; j++) {
												var innerPoints = Number(rankingList[j].points) + Number(predictInstance.point)
												rankingList[j].updateAttribute('points', innerPoints, function(err, res) {
													counter1++
													if (err)
														return cb1(err)
													if (counter1++ == rankingList.length)
														return cb1(null, 'successful')
												})
											}
										})
									}
									function competitionUpdate(cb2) {
										var competition = app.models.competition
										competition.find({'where':{'clientId': clientInst.id.toString()}}, function(err, competitionList) {
											if (err)
												return cb2(err)
											if (competitionList.length == 0)
												return cb2(null)
											var counter2 = 0
											for (var j = 0; j < competitionList.length; j++) {
												var innerPoints = Number(competitionList[j].points) + Number(predictInstance.point)
												competitionList[j].updateAttribute('points', innerPoints, function(err, res) {
													counter2++
													if (err)
														return cb2(err)
													if (counter2 == competitionList.length)
														return cb2(null, 'successful')
												})
											}
										})			
									}
									rankingUpdate(function(err) {
										if (err)
											return cb(err)
										competitionUpdate(function(err) {
											if (err)
												return cb(err)
											var trophy = app.models.trophy
											trophy.trophyCheck(clientInst, function(err, result) {
												counter3++
												if (err)
													return cb(err)
												if (counter3 == estimateList.length)
													return cb(null, result)
											})
										})
									})
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
				if (Number(predictList[i].beginningTime) <= time && Number(predictList[i].endingTime) >= time) {
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
				if (Number(predictList[i].endingTime) <= time) {
					predictList[i].updateAttribute('status', statusConfig.closed, function (err, predictInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	startPredicts.start()
	finishPredicts.start()

  predict.afterRemote('create', function (ctx, modelInstance, next) {
		var league = app.models.league
		if(Object.prototype.toString.call(modelInstance) === '[object Array]') {
			var counter = 0
			for (var i = 0; i < modelInstance.length; i++) {
				var model = modelInstance[i]
				league.findById(model.leagueId.toString(), function(err, leagueInst) {
					if (err)
						return next(err)
					model.leagueRel(leagueInst)
					counter++
					if (counter == modelInstance.length)
						return next()
				})						
			}
		}
		else {
			league.findById(modelInstance.leagueId.toString(), function(err, leagueInst) {
				if (err)
					return next(err)
				modelInstance.leagueRel(leagueInst)
				return next()
			})	
		}
	})

  predict.afterRemote('replaceById', function (ctx, modelInstance, next) {
		if ((modelInstance.status === statusConfig.working || modelInstance.status === statusConfig.closed) && (modelInstance.occurrence && modelInstance.occurrence != 0)) {
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

  predict.finalizePredict = function (predictId, occurrence, callback) {
		var ocr = Number(occurrence)
		predict.findById(predictId.toString(), function(err, modelInstance) {
			if (err)
				return callback(err)
			if ((modelInstance.status === statusConfig.working || modelInstance.status === statusConfig.closed) && (ocr)) {
				var client = app.models.client
				modelInstance.updateAttributes({'status': statusConfig.finished, 'occurrence': ocr}, function(err, predictInstance) {
					if (err)
						return callback(err)
					finishPredict(predictInstance, function(err, result) {
						if (err)
							return callback(err)
						return callback(null, 'Successful Finishing Predict')
					})
				})
			}
			else 
				return callback(new Error('Cant do Finalize'))
		})
  }

  predict.remoteMethod('finalizePredict', {
    accepts: [{
      arg: 'predictId',
      type: 'string',
      http: {
        source: 'path'
      }
    }, {
      arg: 'occurrence',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'finalize a predict',
    http: {
      path: '/finalizePredict/:predictId',
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
