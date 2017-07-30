var utility	= require('../../public/utility')

var request = require('request')

function getRequest(url, callback) {
  request.get(url)
    .on('data', function (data) {
      callback(null, JSON.parse(data))
    })
    .on('error', function (err) {
      console.log(err)
      callback(err, null)
    })
}

module.exports = function (trophy) {

  trophy.trophyCheck = function (clientInst, cb) {
    var badgeArray = [0, 150, 300, 500, 1000, 200, 4000, 8000, 15000, 25000, 50000]
    var totalPoints = clientInst.accountInfoModel.totalPoints
    if (clientInst.trophyModel.level + 1 < badgeArray.length) {
      if (totalPoints > badgeArray[clientInst.trophyModel.level + 1]) {
        var data = {
          'time': utility.getUnixTimeStamp(),
          'level': clientInst.trophyModel.level + 1
        }
        clientInst.trophy.update(data, function(err, result) {
          if (err)
            return cb(err)
          return cb(null, 'successful')
        })
      }
      else {
        return cb(null, 'no need')
      }
    }
  }

	var baseURL = 'http://res.cloudinary.com/dqyiaeoz1/image/upload'

	var farFarColor = 'e_colorize,co_rgb:010101'
	var farColor = 'e_colorize,co_rgb:212121'
	var nameColor = 'e_colorize,co_rgb:313131'

	var rankingFont = ',l_text:BHoma.ttf_50:'
	var namaeFont = ',l_text:BHoma.ttf_100:'

	var rankPosition = ',g_north_east,y_#,x_@'

  trophy.leagueRanking = function (imageName, username, rankings, cb) {
		var str = baseURL

  }

  trophy.remoteMethod('leagueRanking', {
    accepts: [{
      arg: 'imageName',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'username',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'rankings',
      type: 'object',
      http: {
        source: 'query'
      }
    }],
    description: 'send user league ranking trophy image cards',
    http: {
      path: '/leagueRanking',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'Boolean',
      root: true
    }
  })

	var infoColor = 'e_colorize,co_rgb:212121'
	var nameColor = 'e_colorize,co_rgb:313131'

	var namaeFont = ',l_text:BHoma.ttf_100:'

	var rankPosition = ',g_north_east,y_#,x_@'

  trophy.userStats = function (imageName, username, information, cb) {
		var str = baseURL

  }

  trophy.remoteMethod('userStats', {
    accepts: [{
      arg: 'imageName',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'username',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'information',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'send user statistics trophy image cards',
    http: {
      path: '/userStats',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'Boolean',
      root: true
    }
  })

}
