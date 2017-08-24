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
				var point = 0
				var data = {
					'checkTime': time
				}
				data.status = choiceStatusConfig.lose
				if (choiceList[i].firstOption) {
					if (choiceList[i].firstOption.choice === exactInstance.answer) {
						point = Number(choiceList[i].firstOption.point)
						data.status = choiceStatusConfig.win
						choiceList[i].firstOption.status = choiceStatusConfig.win
						choiceList[i].secondOption.status = choiceStatusConfig.lose
						choiceList[i].thirdOption.status = choiceStatusConfig.lose
					}	
				}
				else if (choiceList[i].secondOption) {
					if (choiceList[i].secondOption.choice === exactInstance.answer) {
						point = Number(choiceList[i].secondOption.point)
						data.status = choiceStatusConfig.win
						choiceList[i].secondOption.status = choiceStatusConfig.win
						choiceList[i].firstOption.status = choiceStatusConfig.lose
						choiceList[i].thirdOption.status = choiceStatusConfig.lose
					}	
				}
				else if (choiceList[i].thirdOption.choice) {
					if (choiceList[i].thirdOption.choice === exactInstance.answer) {
						point = Number(choiceList[i].thirdOption.point)
						data.status = choiceStatusConfig.win
						choiceList[i].thirdOption.status = choiceStatusConfig.win
						choiceList[i].secondOption.status = choiceStatusConfig.lose
						choiceList[i].firstOption.status = choiceStatusConfig.lose
					}	
				}
				data.firstOption = choiceList[i].firstOption
				data.secondOption = choiceList[i].secondOption
				data.thirdOption = choiceList[i].thirdOption
				choiceList[i].updateAttributes(data, function(err, updateInstance) {
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
												var innerPoints = Number(rankingList[j].points) + point
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
												var innerPoints = Number(competitionList[j].points) + point
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
				if (Number(exactList[i].beginningTime) <= time && Number(exactList[i].endingTime) >= time) {
					exactList[i].updateAttribute('status', statusConfig.working, function (err, exactInst) {
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
				if (Number(exactList[i].endingTime) <= time) {
					exactList[i].updateAttribute('status', statusConfig.closed, function (err, exactInst) {
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
					var firstPoint = (coeff * Number(model.point))
					var secondPoint = (coeff * Number(model.point) * 0.7)
					var thirdPoint = (coeff * Number(model.point) * 0.4)
					for (var i = 0; i < model.selectors.length; i++) {
						if (model.selectors[i].priority === choicePriorityConfig.high) 
							model.selectors[i].point = firstPoint
						else if (model.selectors[i].priority === choicePriorityConfig.average) 
							model.selectors[i].point = secondPoint
						else if (model.selectors[i].priority === choicePriorityConfig.low) 
							model.selectors[i].point = thirdPoint
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
			if (!model["option"] || !model["priority"])
				return next(new Error('خطا! مدل نمونه پاسخ کامل نیست'))
		}
		for (var i = 0; i < ctx.args.data.selectors.length; i++) {
			var model = ctx.args.data.selectors[i]
			if (model["priority"] === choicePriorityConfig.high)
				ctx.args.data.selectors[i].point = Number(ctx.args.data.point)
			else if (model["priority"] === choicePriorityConfig.average)
				ctx.args.data.selectors[i].point = (Number(ctx.args.data.point) * 0.7)
			else if (model["priority"] === choicePriorityConfig.low)
				ctx.args.data.selectors[i].point = (Number(ctx.args.data.point) * 0.4)
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
