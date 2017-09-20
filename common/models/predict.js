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
			if (estimateList.length == 0) {
				reductionProcess(predictInstance, function(err, result) {
					if (err)
						return cb(err)
					return cb(null, result)
				})
			}
			var time = utility.getUnixTimeStamp()
			var counter3 = 0
			for (var i = 0; i < estimateList.length; i++) {
				var estimateInst = estimateList[i]
				var status = estimateStatusConfig.lose
				if (predictInstance.occurrence == 1)
					status = estimateStatusConfig.win
				estimateInst.updateAttributes({'status': status, 'checkTime': time}, function(err, updateInstance) {
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
										ranking.find({'where':{'clientId': clientInst.id.toString()}, limit: 50000}, function(err, rankingList) {
											if (err)
												return cb1(err)
											if (rankingList.length == 0)
												return cb1(null)
											var counter1 = 0
											for (var j = 0; j < rankingList.length; j++) {
												var rankInst = rankingList[j]
												var innerPoints = Number(rankInst.points) + Number(predictInstance.point)
												rankInst.updateAttribute('points', innerPoints, function(err, res) {
													counter1++
													if (err)
														return cb1(err)
													if (counter1 == rankingList.length)
														return cb1(null, 'successful')
												})
											}
										})
									}
									function competitionUpdate(cb2) {
										var competition = app.models.competition
										competition.find({'where':{'clientId': clientInst.id.toString()}, limit: 50000}, function(err, competitionList) {
											if (err)
												return cb2(err)
											if (competitionList.length == 0)
												return cb2(null)
											var counter2 = 0
											for (var j = 0; j < competitionList.length; j++) {
												var compInst = competitionList[j]
												var innerPoints = Number(compInst.points) + Number(predictInstance.point)
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
						counter3++
						if (counter3 == estimateList.length) {
							// reductionProcess(predictInstance, function(err, result) {
							// 	if (err)
							// 		return cb(err)
								// return cb(null, result)
							// })
							return cb(null, 'successful')
						}
					}
				})
			}					
		})
	}

	function reductionProcess(predictInst, cb) {
		var cross = 0
		function rankingUpdate(clientInst, reductionPoint, cb1) {
			var ranking = app.models.ranking
			ranking.find({'where':{'clientId': clientInst.id.toString()}, limit: 50000}, function(err, rankingList) {
				if (err)
					return cb1(err)
				if (rankingList.length == 0)
					return cb1(null)
				var counter1 = 0
				for (var j = 0; j < rankingList.length; j++) {
					var rankInst = rankingList[j]
					var innerPoints = Number(rankInst.points) - Number(reductionPoint)
					if (innerPoints < 0)
						innerPoints = 0
					rankInst.updateAttribute('points', innerPoints, function(err, res) {
						counter1++
						if (err)
							return cb1(err)
						if (counter1 == rankingList.length)
							return cb1(null, 'successful')
					})
				}
			})
		}
		function competitionUpdate(clientInst, reductionPoint, cb2) {
			var competition = app.models.competition
			competition.find({'where':{'clientId': clientInst.id.toString()}, limit: 50000}, function(err, competitionList) {
				if (err)
					return cb2(err)
				if (competitionList.length == 0)
					return cb2(null)
				var counter2 = 0
				for (var j = 0; j < competitionList.length; j++) {
					var compInst = competitionList[j]
					var innerPoints = Number(compInst.points) - Number(reductionPoint)
					if (innerPoints < 0)
						innerPoints = 0
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
		function userReduction(clientInst, fullReduction, cb8) {
			var userPoint = 0
			console.log('FREDUC: ' + fullReduction)
			userPoint = Number(clientInst.accountInfoModel.totalPoints) - fullReduction
			clientInst.accountInfo.update({'totalPoints': userPoint}, function(err, result) {
				if (err)
					return cb8(err)
				return cb8(null, 'successful')
			})			
		}
		function leagueUpdate(clientInst, leagueId, reductionPoint, cb3) {
			var leaguePoint = 0
			if (clientInst.checkpointModel.leagues[leagueId.toString()]) 
				leaguePoint = Number(clientInst.checkpointModel.leagues[leagueId.toString()])
			var innerPoints = leaguePoint - Number(reductionPoint)
			if (innerPoints < 0)
				innerPoints = 0
			clientInst.checkpointModel.leagues[leagueId.toString()] = innerPoints
			clientInst.checkpoint.update({'leagues': clientInst.checkpointModel.leagues}, function(err, result) {
				if (err)
					return cb3(err)
				return cb3(null, 'successful')
			})
		}
		function estimatesUpdate(leagueEstimates, cb4) {
			var counter4 = 0
			if (leagueEstimates.length == 0)
				return cb4(null)
			for (var k = 0; k < leagueEstimates.length; k++) {
				var estimateModel = leagueEstimates[k]
				var estimate = app.models.estimate
				estimate.findById(estimateModel.id, function(err, estimateInst) {
					if (err)
						return cb4(err)
					estimateInst.updateAttribute('reductionCheck', 'true', function(err, updateInst) {
						if (err)
							return cb4(err)
						counter4++
						if (counter4 == leagueEstimates.length)
							return cb4(null, 'successful')
					})	
				})
			}
		}
		function perLeagueExec(clientInst, leagueId, innerModel, leagueReduction, fullReduction, cb5) {
			leagueUpdate(clientInst, leagueId, leagueReduction, function(err, leagueResult) {
				if (err)
					return cb5(err)
				estimatesUpdate(innerModel, function(err, estimateResult) {
					if (err)
						return cb5(err)
					return cb5(null, clientInst, fullReduction)
				})					
			})
		}
		function afterLeagueExec(clientInst, fullReduction, cb9) {
			userReduction(clientInst, fullReduction, function(err, userResult) {
				if (err)
					return cb9(err)
				rankingUpdate(clientInst, fullReduction, function(err, rankingResult) {
					if (err)
						return cb9(err)
					competitionUpdate(clientInst, fullReduction, function(err, compResult) {
						if (err)
							return cb9(err)
						return cb9(null, 'successful')
					})
				})
			})	
		}
		function executeAlgorithm(userId, userModel, cb6) {
			var client = app.models.client
			client.findById(userId.toString(), function(err, clientInst) {
				if (err)
					return cb6(err)

				if (!userModel.count || userModel.count == 0)
					return cb6(null)

				var fullReduction = 0
				var fullCount = Number(userModel.count)

				var head = Math.round(cross / 2)

				if (fullCount < head) {
					if (fullCount >= 0 && fullCount <= 14)
						fullReduction = 0
					else 
						fullReduction = ((Math.floor((fullCount / 5)) - 2) * 25)
				}
				else {
					fullReduction = 15 * fullCount
				}

				console.log('++++++++++++++++++++++++++')
				console.log('USERID: ' + userId)
				console.log('COUNT: ' + fullCount)
				console.log('FULLREDUC: ' + fullReduction)

				var innerList = []
				for (var key in userModel)
					if (key !== 'count')
						innerList.push(key)
				if (innerList.length == 0)
					return cb6(null)
				var counter6 = 0
				for (var j = 0; j < innerList.length; j++) {
					var leagueId = innerList[j]
					var innerModel = (userModel[leagueId])
					if (innerModel.length == 0) {
						counter6++
						if (counter6 == innerList.length)
							return cb6(null, 'successful')
						continue						
					}
					console.log('LEAGUESIZE: ' + innerModel.length)
					var leagueReduction = Math.round(((innerModel.length / fullCount) * fullReduction))
					console.log('LEAGUEREDUC: ' + leagueReduction)
					perLeagueExec(clientInst, leagueId, innerModel, leagueReduction, fullReduction, function(err, clientRes, fullReducRes) {
						if (err)
							return cb6(err)
						counter6++
						if (counter6 == innerList.length) {
							afterLeagueExec(clientRes, fullReducRes, function(err, afterLeagueResult) {
								if (err)
									return cb6(err)
								return cb6(null, 'successful')
							})
						}
					})
				}				
			})
		}
		function reductionAlgo(userList, cb7) {
			var userKeyList = []
			for (var key in userList) 
				userKeyList.push(key)
			if (userKeyList.length == 0)
				return cb7(null)
			var counter7 = 0
			for (var i = 0; i < userKeyList.length; i++) {
				var userId = userKeyList[i]
				var userModel = userList[userId]
				executeAlgorithm(userId, userModel, function(err, algoResult) {
					if (err)
						return cb7(err)
					counter7++
					if (counter7 == userKeyList.length)
						return cb7(null, 'successful')
				})
			}
		}

		predict.find({'include':'estimates', 'limit': 50000, 'where':{and:[{'weekNumber': predictInst.weekNumber.toString()}, {'occurrence': '2'}]}}, function(err, predictList) {
			if (err)
				return cb(err)
			if (predictList.length == 0)
				return cb(null, 'no other predicts')
			cross = predictList.length
			var userList = {}
			for (var j = 0; j < predictList.length; j++) {
				var pInst = JSON.parse(JSON.stringify(predictList[j]))
				for (var k = 0; k < pInst.estimates.length; k++) {
					var eInst = pInst.estimates[k]
					if (!eInst)
						continue
					if (eInst.reductionCheck === 'true')
						continue
					if (!userList[eInst.clientId.toString()]) {
						userList[eInst.clientId.toString()] = {}
						var m = userList[eInst.clientId.toString()]
						m.count = 1
						m[pInst.leagueId] = []
						m[pInst.leagueId].push(eInst)
						userList[eInst.clientId.toString()] = m
					}
					else {
						var m = userList[eInst.clientId.toString()]
						if (!m[pInst.leagueId])
							m[pInst.leagueId] = []
						m[pInst.leagueId].push(eInst)
						m.count += 1
						userList[eInst.clientId.toString()] = m
					}
				}
			}
			predict.count({and:[{'weekNumber': predictInst.weekNumber.toString()}, {'tag':{'inq':['Week', 'Live']}}]}, function(err, countRes) {
				if (err)
					return cb(err)
				cross = 0
				if (countRes)
					cross = Number(countRes)
				console.log(cross)
				reductionAlgo(userList, function(err, algoRes) {
					if (err)
						return cb(err)
					return cb(null, 'successful')
				})	
			})
		})
	}

	var startPredicts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		predict.find({
			where: {
				'status': statusConfig.created
			},
			limit: 50000
		}, function (err, predictList) {
			if (err)
				console.error(err)
			for (var i = 0; i < predictList.length; i++) {
				var model = predictList[i]
				if (Number(model.beginningTime) <= time && Number(model.endingTime) >= time) {
					model.updateAttribute('status', statusConfig.working, function (err, predictInst) {
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
			},
			limit: 50000
		}, function (err, predictList) {
			if (err)
				console.error(err)
			for (var i = 0; i < predictList.length; i++) {
				var model = predictList[i]
				if (Number(model.endingTime) <= time) {
					if (model.tag === tagConfig.mock) {
						model.destroy(function(err) {
							if (err)
								console.error(err)
						})
					}
					else {
						model.updateAttribute('status', statusConfig.closed, function (err, predictInst) {
							if (err)
								console.error(err)
						})	
					}
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
					if (!leagueInst)
						return next(new Error('خطا! لیگ معتبری با این مشخصات وجود ندارد'))		
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
				if (!leagueInst)
					return next(new Error('خطا! لیگ معتبری با این مشخصات وجود ندارد'))	
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
