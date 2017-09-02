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

}
