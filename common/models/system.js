'use strict';
const log4js = require('log4js');
const logger = log4js.getLogger("System");
const request = require('request');
const {exec} = require('child_process');
const config = require('../../server/config.json');

module.exports = function(System) {
  System.remoteMethod(
    'SystemStatus',
    {
      http: {path: '/SystemStatus', verb: 'POST'},
      description: "사용자 리스트",
      accepts: [
        {arg: 'names', type: 'array'},
        {arg: 'req', type: 'object', http: {source: "req"}},
        {arg: 'res', type: 'object', http: {source: "res"}}
      ],
      returns: {arg: 'data'}
    }
  );
  System.SystemStatus = async (names, req, res) => {

    let aJsonArray = new Array();

    await Promise.all(names.map(async function (name) {
      return new Promise((resolved, rejected) => {

        getToken( function (token) {
          getID(token.jwt, function (list){

            list.map(async function(data2) {
              let name2 = data2.Names[0].split('.');
              if(name == name2[0].substr(1)){
                getData(data2.Id, token.jwt, function (data) {
                  exec('df', (err, stdout, stderr) => {
                    if (err) {
                      logger.error(err);
                      rejected(err);
                    } else {
                      data.diskUsage = [];

                      let rows = stdout.split('\n');
                      for (let i = 1; i < rows.length-1; i++) {
                        let json = {};
                        rows[i] = rows[i].replace(/ +/g, " ");
                        let info = rows[i].split(' ');
                        json.name = info[5];
                        json.total_byte = info[1];
                        json.used_byte = info[2];
                        json.avail_byte = info[3];
                        json.per_use = info[4];

                        data.diskUsage.push(json);
                      } //for
                      aJsonArray.push(data);
                      resolved(aJsonArray);
                    }//else
                  }); //exec
                }); //getData
              }
            }); //list


          }); //getID
        });
      });
    }));
    return {"container": aJsonArray};
  };

  function getToken(callbackFunc) {
    request.post({
      headers: { 'content-type': 'application/json'},
      url: config.config.portainer.url + '/api/auth',
      body: {"username" : config.config.portainer.username, "password" : config.config.portainer.password },
      json: true

    }, function (error, response, body) {
      if (error) {
        logger.error(error);
      } else {
        callbackFunc(body);
      }

    });
  }

  function getID(token, callbackFunc) {
    request.get({
      headers: { 'content-type': 'application/json' , 'Authorization': token},
      url: config.config.portainer.url + '/api/endpoints/1/docker/containers/json?all=1',
      body:'',
      json: true

    }, function (error, response, body) {
      if (error) {
        logger.error(error);
      } else {
        callbackFunc(body);
      }

    });
  }

  function getData(id, token, callbackFunc) {
    request.get({
      headers: {
        'content-type': 'application/json',
        'Authorization': token
      },
      url: config.config.portainer.url + '/api/endpoints/1/docker/containers/' + id + '/json',
      body: '',
      json: true

    }, function (error, response, body) {
      let aJson = new Object();
      if (error) {
        logger.error(error);
      } else {
        aJson.name = body.Name.substr(1);
        aJson.id = body.Id;
        aJson.status = body.State.Status;
        callbackFunc(aJson);
      }

    });
  }
};
