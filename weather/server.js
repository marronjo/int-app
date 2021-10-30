"use strict";

const PORT = 5500;

const apiKey = require('../secrets.json').apiKey;

const express = require('express');
const path = require("path");
const fetch = require("cross-fetch");

const app = express();

//refers to the client.html file in public folder
let pathName = path.resolve(__dirname, "public");
app.use(express.static(pathName));

//urls for 3 fetch commands
const first = 'https://api.openweathermap.org/data/2.5/weather?q=';
const second = '&appid=' + apiKey;

const lati = 'https://api.openweathermap.org/data/2.5/onecall?lat=';
const long = '&lon=';
const exclude = '&exclude=minutely,hourly,alerts&units=metric&appid=' + apiKey; 

const air = 'https://api.openweathermap.org/data/2.5/air_pollution?lat=';
const air2 = '&lon=';

//get command, makes the data available to frontend 
app.get('/weather/:city/:country', getWeather);

function getWeather(req, res){
    let city = req.params.city;
    let country = req.params.country;

    let url = first + city + "," + country + second;

    //fetch current data from given city/country
    fetch(url).then((response) => {
        return response.json();
    }).then(data => {
        const lat = data.coord.lat; //latitude
        const lon = data.coord.lon; //longitude

        let link = lati + lat + long + lon + exclude;
        //fetch 7 day weather data using latitude and longitude
        fetch(link).then((result) => {
            return result.json();
        }).then(info => {
            let array = [];
            for (let i = 0; i < 5; i++){
                let wind = info.daily[i].wind_speed;
                let rain = info.daily[i].rain;

                array.push([info.daily[i].temp, info.daily[i].weather, {"wind" : wind}, {"rain" : rain}]);
            }

            let urlAir = air + lat + air2 + lon + second;
            //fetch air pollution data using latitude and longitude
            fetch(urlAir).then((airpoll) => {
                return airpoll.json();
            }).then((pollution) => {
                const pm25 = pollution.list[0].components.pm2_5;  //pm2_5 (single number) 
                const pack = packing(array);                      //pack for rain? (true/false)
                const tem = temp(array);                          //max and min temperatue for next 5 days including hot/cold string (max, hot/cold, min, hot/cold)
                const tab = table(array);                         //wind, rain and daytime temp for each of the next 5 days
               
                const final = [];
                final.push(pack, tem, tab, pm25);                 //add 4 metrics to array
                res.send(final);                                  //resolve single array to frontend
            });
    
            //return example = [true/false,[20,"Hot",5,"Cold"],[[21 (wind), 12 (rain) , 34 (temp)] x5 days .. , pm2_5 reading]
        });
    });
}

function table(array){
    let newarr = [];
    for(let i = 0; i < array.length; i++){
        let obj = array[i];
        newarr.push([obj[2].wind, obj[3].rain, obj[0].day]);
    }
    return newarr;
}

function temp(array){
    let max = 0;
    let min = 9999;
    for(let i = 0; i < array.length; i++){
        if (array[i][0].min < min && array[i][0].max > max){
            max = array[i][0].max;
            min = array[i][0].min;
        }
        else if(array[i][0].min < min){
            min = array[i][0].min;
        }
        else if(array[i][0].max > max){
            max = array[i][0].max;
        }
    }
    let maxs = hotCold(max);
    let mins = hotCold(min);

    return [max, maxs, min, mins];
}

function hotCold(input){
    if(input < 10){    //temp less than 10
        return "Cold";
    }
    else if(input >= 10 && input < 20){ //temp between 10 and 20 (including 10)
        return "Warm";
    }
    else{
        return "Hot";   //temp greater than or equal to 20
    }
}

function packing(array){
    for (let i = 0; i < array.length; i++){
        if(array[i][1][0].main == "Rain"){
            return true;
        }
    }
}

//sets port number to environment variable if its set, otherwise defaults to PORT variable
const port = process.env.PORT || PORT;
app.listen(port, () => console.log(`Listening on port ${port}`));