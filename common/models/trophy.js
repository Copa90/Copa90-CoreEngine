var app = require('../../server/server')
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
    var badgeArray = [0, 500, 3000, 8000, 15000, 30000, 50000, 100000, 200000, 500000, 1000000]
    var totalPoints = Number(clientInst.accountInfoModel.totalPoints)
    var level = 0
    for (var i = 0; i < (badgeArray.length); i++) {
      if (totalPoints >= badgeArray[i])
        level++
      else
        break
    }
    var data = {
      'time': utility.getUnixTimeStamp(),
      'level': level
    }
    clientInst.trophy.update(data, function(err, result) {
      if (err)
        return cb(err)
      return cb(null, 'successful')
    })
  }

  trophy.recheckTrophy = function (cb) {
    var client = app.models.client
    client.find({where:{phoneNumber:{neq: '09120001122'}}, limit: 50000}, function(err, clientList) {
      if (err)
        return cb(err)
      var counter = 0
      for (var i = 0; i < clientList.length; i++) {
        var model = clientList[i]
        trophy.trophyCheck(model, function(err, result) {
          if (err)
            return cb(err)
          counter++
          if (counter == clientList.length)
            return cb(null, counter + ' clients rechecked for trophy')
        })
      }
    })
  }

  trophy.remoteMethod('recheckTrophy', {
    accepts: [],
    description: 'recheck trophy points for all of clients',
    http: {
      path: '/recheckTrophy',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })
  
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
