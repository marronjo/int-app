const express = require('express');
const app = express();
const PORT = 3000;

const path = require("path");
let pathName = path.resolve(__dirname, "public");
app.use(express.static(pathName));

app.get('/', storeMovies);
app.get('/:year/:name/:rating', queryMovies);
app.get('/delete', deleteMovies);

const public = require('../secrets.json').awsPublic;
const private = require('../secrets.json').awsPrivate;

var AWS = require('aws-sdk');
const config = new AWS.Credentials(public, private);

AWS.config.update({
    region: "eu-west-1",
    credentials: config
});

var s3 = new AWS.S3();
var docClient = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB();

function waitTable(){
    dynamodb.describeTable({ TableName: "Movies"}, function(err, data) {
        while(err || !data){
            return new Promise(resolve => setTimeout(resolve, 5000));   //wait 5 seconds if error
        }
        if(data.Table.TableStatus !== "ACTIVE"){
            return new Promise(resolve => setTimeout(resolve, 5000));   //wait 5 seconds if not created yet
        }
        else{
            console.log("Table Created!");
        }
    });
}

function storeMovies(req, res){

    var params = {
        Bucket: 'csu44000assignment220',
        Key: 'moviedata.json'
    }
    s3.getObject(params, function(err, data){
        const movies = JSON.parse(data.Body);

        var params = {
            TableName : "Movies",
            KeySchema: [       
                { AttributeName: "year", KeyType: "HASH"},
                { AttributeName: "title", KeyType: "RANGE" }  
            ],
            AttributeDefinitions: [       
                { AttributeName: "year", AttributeType: "N" },
                { AttributeName: "title", AttributeType: "S" }
            ],
            ProvisionedThroughput: {       
                WriteCapacityUnits: 5,
                ReadCapacityUnits: 1
            }
        };
    
        dynamodb.createTable(params, function(err, data) {
            if (err) {
                console.error(JSON.stringify(err, null, 2));
            } else {
                console.log(JSON.stringify(data, null, 2));
            }
        });

        waitTable();     

        movies.forEach(function(movie) {
            var movieData = {
                TableName: 'Movies',
                Item : {
                    'title': movie.title,
                    'year': movie.year,
                    'release_date': movie.info.release_date,
                    'rating': movie.info.rating,
                    'rank': movie.info.rank
                },
            };
            docClient.put(movieData, function(err, data) {
                if(err) {
                    console.log(err);
                    }
                else { 
                    console.log(movie.title);
                }
            });
        });
        console.log("Finished adding everything");
        res.sendStatus(200);
    });
}

function queryMovies(req, res){
    let yearInput = parseInt(req.params.year);
    let name = req.params.name;
    let rating = parseInt(req.params.rating);

    console.log("query in progress ...");
    var response = [];

    var params = {
        TableName : "Movies",
        KeyConditionExpression: "#yr = :yyyy AND begins_with(#ti, :input)",
        ExpressionAttributeNames:{
            "#yr": "year",
            "#ti": "title"
        },
        ExpressionAttributeValues: {
            ":yyyy": yearInput,
            ":input": name
        }
    };
    docClient.query(params, function(err, data){
        if(err){
            console.log(err);
        }
        else{
            data.Items.forEach(function(item){ 
                if(item.rating >= rating) {
                    response.push(item);
                    console.log(item.year, " ", item.title, " ", item.rating);
                }
            });
            res.send(response);
        }
    });
}

function deleteMovies(req, res){
    console.log("delete in progress");
    var params = {
        TableName : "Movies"
    }
    dynamodb.deleteTable(params, function(err, data) {
        if(err) console.log(JSON.stringify(err, null, 2));
        else{
            console.log(JSON.stringify(data, null, 2));
            console.log("DELETE DELETE");
            res.sendStatus(200);
        }
    });
}

const port = process.env.PORT || PORT;
app.listen(port, () => console.log(`Listening on port ${port}`));