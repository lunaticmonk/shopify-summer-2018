"use strict";

// -----------------------External dependencies----------------------//

const https = require('https');
const Bluebird = require('bluebird');
const request =  Bluebird.promisifyAll(require("request"), { multiArgs: true});
const express = require('express');
const app = express();

// -------- Function to get the responses from all the pages available --------//
function bakeAPIResponse(baseURL) {
  let results = {};
  let apiResponse = [];
  return new Promise((resolve, reject) => {
    // Requesting first page to get the pagination details
    https.get(`${baseURL}&page=1`, (res) => {
      if (res.statusCode != 200) {
        throw new Error('No response from api');
      }
      res.on('data', (data) => {
        results = JSON.parse(data.toString());
        let pagination = results.pagination;
        results.menus.forEach(menu => {
          if (apiResponse.length < pagination.total) {
            apiResponse.push(menu);
          }
        });
        // ----- Getting nodes from all other pages --------//
        getAllResponses(pagination);
      });

      function getAllResponses(pagination) {
        let urls = [];
        let totalPages = Math.ceil((pagination.total)/pagination.per_page);
        for (let i = 2; i <= totalPages; i++) {
          let url = `${baseURL}&page=${i}`;
          urls.push(url);
        }
        Bluebird.map(urls, (url) => {
          return request.getAsync(url).spread((response, body) => {
            return JSON.parse(body);
          });
        })
        .then((results) => {
          results.forEach(result => {
            // Concatenating the nodes array to get the final list of nodes
            apiResponse = apiResponse.concat(result.menus);
          });
          resolve(apiResponse);
        }).catch(err => {
          console.log(err);
          reject(err);
        });
      }
    });

  });
}

// ---------- Validating if our menus are offended or not ------------//
function validateMenus(allMenus) {
  let graph = {};
  let parents= [];
  let visit =  new Array(50).fill(0);
  let inStack = new Array(50).fill(0);
  let components = {};
  let root_nodes = [];

  // ----------- Preparing a graph of all the nodes ---------------//
    allMenus.forEach(elem => {
      if(elem.hasOwnProperty("parent_id")) {
        parents[elem.id] = elem.parent_id;
      }
      else {
        root_nodes.push(elem.id);
      }

      if (elem.child_ids.length > 0) {
        elem.child_ids.forEach(id => {
          if (!graph[elem.id]) graph[elem.id] = []
          graph[elem.id].push(id);
        });
      }
    });

    let currentComponent = 1;
    let res = {
      "valid_menus": [],
      "invalid_menus": []
    };
    for(let i = 0; i<= root_nodes.length; i++){
      if(visit[root_nodes[i]] == 0) {
        let ans = dfs(root_nodes[i], currentComponent);
        if (ans == true) {
            res["invalid_menus"].push({"root_id": root_nodes[i], "children": components[currentComponent]});
        }
        else {
          res["valid_menus"].push({"root_id": root_nodes[i], "children": components[currentComponent]});
        }
        currentComponent += 1;
      }
    }


    // ------------- The dfs traversal function to check if there is cycle in our graph of menus --------------//
    function dfs(node, componentId) {
      visit[node] = 1;
      inStack[node] = 1;
      if(!components[componentId]) {
        components[componentId] = [];
      }
      let flag = false;
      components[componentId].push(node);
      if(!graph[node]) {
        return flag;
      }
      for (let i = 0; i < graph[node].length; i++) {
        let nextNode = graph[node][i];
        if(!visit[nextNode]) {
          flag = (flag | dfs(nextNode, componentId) );
        }
        else if(inStack[nextNode]) {
          flag = true;
        }
      }
      inStack[node] = 0;
      return flag;
    }

    function formatValidChildren(validmenus) {
      return new Promise((resolve, reject) => {
        for (let j = 0; j < validmenus.length; j++) {
          validmenus[j].children = validmenus[j].children.slice(1);
        }
        resolve(validmenus);
      });
    }

    formatValidChildren(res.valid_menus).then(formattedValidChildren => {
      res.valid_menus.children = formattedValidChildren;
    });
    console.log('Valid: ', res.valid_menus);
    console.log('Invalid: ', res.invalid_menus);
    return res;
}

app.get('/', (req, res) => {
  let jsonResponse;
  bakeAPIResponse('https://backend-challenge-summer-2018.herokuapp.com/challenges.json?id=1').then(allmenus => {
    jsonResponse = validateMenus(allmenus);
    res.send(jsonResponse);
  });
});

app.get('/extra', (req, res) => {
  let jsonResponse;
  bakeAPIResponse('https://backend-challenge-summer-2018.herokuapp.com/challenges.json?id=2').then(allmenus => {
    jsonResponse = validateMenus(allmenus);
    res.send(jsonResponse);
  });
});

app.listen(5000);
console.log('listening to 5000');
