var utility = require('../../public/utility')
var userStatus = require('../../config/userStatus.json')

module.exports = function (app) {
  var mongoDs = app.dataSources.mongoDs

  var User = app.models.client
  var Role = app.models.Role
  var RoleMapping = app.models.RoleMapping

	var time = utility.getUnixTimeStamp()
	var status = userStatus.available

  var users = [{
      username: 'wooj',
      email: 'ceo@copa90.com',
      password: 'C0p4AlirezaPass',
			fullname: 'Copa Admin',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    },
    {
      username: 'support1',
      email: 'support1@copa90.com',
      password: 'C0p4Support1Pass',
			fullname: 'Copa Support1',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    },
    {
      username: 'support2',
      email: 'support2@copa90.com',
      password: 'C0p4Support2Pass',
			fullname: 'Copa Support2',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    },
    {
      username: 'support3',
      email: 'support3@copa90.com',
      password: 'C0p4Support3Pass',
			fullname: 'Copa Support3',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    },
    {
      username: 'support4',
      email: 'support4@copa90.com',
      password: 'C0p4Support4Pass',
			fullname: 'Copa Support4',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    },
    {
      username: 'support5',
      email: 'support5@copa90.com',
      password: 'C0p4Support5Pass',
			fullname: 'Copa Support5',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    }
  ]

  function createRoles(users) {
    var role1 = {
      name: 'founder'
    }

    Role.create(role1, function (err, role) {
      if (err)
        throw err
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[0].id
      }, function (err, principal) {
        if (err)
          throw err
      })
    })

    var role2 = {
      name: 'admin'
    }
    Role.create(role2, function (err, role) {
      if (err)
        throw err
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[1].id
      }, function (err, principal) {
        if (err)
          throw err
      })
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[2].id
      }, function (err, principal) {
        if (err)
          throw err
      })
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[3].id
      }, function (err, principal) {
        if (err)
          throw err
      })
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[4].id
      }, function (err, principal) {
        if (err)
          throw err
      })
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[5].id
      }, function (err, principal) {
        if (err)
          throw err
      })
    })
  }

  User.create(users, function (err, users) {
    if (err) {
      User.find({'where': {'phoneNumber': '09120001122'}}, function(err, result) {
        if (err)
          throw err
        createRoles(result)
      })
    }
    else {
      createRoles(users)
    }
  })

}
