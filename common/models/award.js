var cron = require('cron')
var app = require('../../server/server')

var rwc = require('random-weighted-choice')

var utility	= require('../../public/utility')

function randomNonEqualChance(table, number) {
	var result = []
	for (var i = 0; i < number; i++)
		result.push(rwc(table))
	return result
}

module.exports = function(award) {

	var monthlyAward = cron.job("0 0 0 1 * *", function () {


		
	})

	monthlyAward.start()

	var weeklyAward = cron.job("0 0 0 * * 0", function () {

	})

	weeklyAward.start()
}
