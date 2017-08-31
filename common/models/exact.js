var cron = require('cron')
var app = require('../../server/server')

var utility	= require('../../public/utility')
var statusConfig = require('../../config/exactStatus.json')
var labelConfig = require('../../config/exactLabels.json')
var topicConfig = require('../../config/exactTopics.json')
var choiceStatusConfig = require('../../config/choiceStatus.json')
var choicePriorityConfig = require('../../config/choicePriority.json')

module.exports = function(exact) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	exact.validatesInclusionOf('status', {in: statusList})

  var labelList = []
  for (var key in labelConfig) 
    labelList.push(labelConfig[key])

	exact.validatesInclusionOf('label', {in: labelList})

  var topiclList = []
  for (var key in topicConfig) 
    topiclList.push(topicConfig[key])

	exact.validatesInclusionOf('topic', {in: topiclList})

	function finishExact(exactInstance, cb) {
		exactInstance.choices({'status': choiceStatusConfig.open}, function(err, choiceList) {
			if (err)
				return cb(err)
			if (choiceList.length == 0)
				return cb(null)
			var time = utility.getUnixTimeStamp()
			var counter3 = 0
			for (var i = 0; i < choiceList.length; i++) {
				var choiceInst = choiceList[i]
				var point = 0
				var data = {
					'checkTime': time
				}
				data.status = choiceStatusConfig.lose
				if (choiceInst.firstOption) {
					if (choiceInst.firstOption.choice === exactInstance.answer) {
						point = Number(choiceInst.firstOption.point)
						data.status = choiceStatusConfig.win
						choiceInst.firstOption.status = choiceStatusConfig.win
						choiceInst.secondOption.status = choiceStatusConfig.lose
						choiceInst.thirdOption.status = choiceStatusConfig.lose
					}	
				}
				else if (choiceInst.secondOption) {
					if (choiceInst.secondOption.choice === exactInstance.answer) {
						point = Number(choiceInst.secondOption.point)
						data.status = choiceStatusConfig.win
						choiceInst.secondOption.status = choiceStatusConfig.win
						choiceInst.firstOption.status = choiceStatusConfig.lose
						choiceInst.thirdOption.status = choiceStatusConfig.lose
					}	
				}
				else if (choiceInst.thirdOption.choice) {
					if (choiceInst.thirdOption.choice === exactInstance.answer) {
						point = Number(choiceInst.thirdOption.point)
						data.status = choiceStatusConfig.win
						choiceInst.thirdOption.status = choiceStatusConfig.win
						choiceInst.secondOption.status = choiceStatusConfig.lose
						choiceInst.firstOption.status = choiceStatusConfig.lose
					}	
				}
				data.firstOption = choiceInst.firstOption
				data.secondOption = choiceInst.secondOption
				data.thirdOption = choiceInst.thirdOption
				choiceInst.updateAttributes(data, function(err, updateInstance) {
					if (err)
						return cb(err)
					if (updateInstance.status === choiceStatusConfig.win) {
						updateInstance.clientRel(function(err, clientInst) {
							if (err)
								return cb(err)
							var newRoundWins = Number(clientInst.accountInfoModel.roundWins) + 1
							var newTotalPoints = Number(clientInst.accountInfoModel.totalPoints) + point
							clientInst.accountInfo.update({'roundWins': newRoundWins, 'totalPoints': newTotalPoints}, function(err, accountInst) {
								if (err)
									return cb(err)
								var leaguePoint = 0
								if (clientInst.checkpointModel.leagues[exactInstance.leagueId.toString()]) 
									leaguePoint = Number(clientInst.checkpointModel.leagues[exactInstance.leagueId.toString()])
								clientInst.checkpointModel.leagues[exactInstance.leagueId.toString()] = leaguePoint + point
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
												var rankInst = rankingList[j]
												var innerPoints = Number(rankInst.points) + point
												rankInst.updateAttribute('points', innerPoints, function(err, res) {
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
												var compInst = competitionList[j]
												var innerPoints = Number(compInst.points) + point
												compInst.updateAttribute('points', innerPoints, function(err, res) {
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
												if (counter3 == choiceList.length)
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

	var startExacts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		exact.find({
			where: {
				'status': statusConfig.created
			}
		}, function (err, exactList) {
			if (err)
				console.error(err)
			for (var i = 0; i < exactList.length; i++) {
				var exactInst = exactList[i]
				if (Number(exactInst.beginningTime) <= time && Number(exactList[i].endingTime) >= time) {
					exactInst.updateAttribute('status', statusConfig.working, function (err, exactInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	var finishExacts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		exact.find({
			where: {
				'status': statusConfig.working
			}
		}, function (err, exactList) {
			if (err)
				console.error(err)
			for (var i = 0; i < exactList.length; i++) {
				var exactInst = exactList[i]
				if (Number(exactInst.endingTime) <= time) {
					exactInst.updateAttribute('status', statusConfig.closed, function (err, exactInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	startExacts.start()
	finishExacts.start()

	var weeklyReduction = cron.job("0 0 0 * * 0", function () {
		var time = utility.getUnixTimeStamp()
		exact.find({
			where: {
				'status': statusConfig.working
			}
		}, function (err, exactList) {
			if (err)
				console.error(err)
			for (var i = 0; i < exactList.length; i++) {
				var model = exactList[i]
				if (Number(model.beginningTime) + (6 * 24 * 60 * 60 * 1000) >= time) {
					var passed = (time - Number(model.beginningTime))
					var coeff = ((Number(model.endingTime) - passed) / Number(model.endingTime))
					for (var i = 0; i < model.selectors.length; i++) {
						var firstPoint = (coeff * Number(model.selectors[i].point.first))
						var secondPoint = (coeff * Number(model.selectors[i].point.second) * 0.7)
						var thirdPoint = (coeff * Number(model.selectors[i].point.third) * 0.4)
						model.selectors[i].point.first = firstPoint
						model.selectors[i].point.second = secondPoint
						model.selectors[i].point.third = thirdPoint
					}
					model.updateAttribute('selectors', model.selectors, function (err, exactInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})		
	})

	weeklyReduction.start()

  exact.beforeRemote('create', function (ctx, modelInstance, next) {
		for (var i = 0; i < ctx.args.data.selectors.length; i++) {
			var model = ctx.args.data.selectors[i]
			if (!model["choice"] || !model["point"])
				return next(new Error('خطا! مدل نمونه پاسخ کامل نیست'))
			if (!model.point["first"] || !model.point["second"] || !model.point["third"])
				return next(new Error('خطا! مدل نمونه امتیازات کامل نیست'))
		}
		for (var i = 0; i < ctx.args.data.selectors.length; i++) {
			ctx.args.data.selectors[i].point.first = Number(ctx.args.data.selectors[i].point.first)
			ctx.args.data.selectors[i].point.second = Number(ctx.args.data.selectors[i].point.second)
			ctx.args.data.selectors[i].point.third = Number(ctx.args.data.selectors[i].point.third)
		}
		return next()
	})

  exact.afterRemote('create', function (ctx, modelInstance, next) {
		var league = app.models.league
		league.findById(modelInstance.leagueId.toString(), function(err, leagueInst) {
			if (err)
				return next(err)
			modelInstance.leagueRel(leagueInst)
			return next()
		})	
	})

  exact.afterRemote('replaceById', function (ctx, modelInstance, next) {
		if ((modelInstance.status === statusConfig.working || modelInstance.status === statusConfig.closed) && (modelInstance.answer && modelInstance.answer !== '')) {
			var client = app.models.client
			modelInstance.updateAttribute('status', statusConfig.finished, function(err, exactInstance) {
				if (err)
					return next(err)
				finishExact(exactInstance, function(err, result) {
					if (err)
						return next(err)
					return next()
				})
			})
		}
		else 
			return next()
	})

  exact.finalizeExact = function (exactId, answer, callback) {
		exact.findById(exactId.toString(), function(err, modelInstance) {
			if (err)
				return callback(err)
			if ((modelInstance.status === statusConfig.working || modelInstance.status === statusConfig.closed) && (answer)) {
				var client = app.models.client
				modelInstance.updateAttributes({'status': statusConfig.finished, 'answer': answer}, function(err, exactInstance) {
					if (err)
						return callback(err)
					finishExact(exactInstance, function(err, result) {
						if (err)
							return callback(err)
						return callback(null, 'Successful Finishing Exact')
					})
				})
			}
			else 
				return callback(new Error('Cant do Finalize'))
		})
  }

  exact.remoteMethod('finalizeExact', {
    accepts: [{
      arg: 'exactId',
      type: 'string',
      http: {
        source: 'path'
      }
    }, {
      arg: 'answer',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'finalize an exact',
    http: {
      path: '/finalizeExact/:exactId',
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
