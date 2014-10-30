var http = require('http');
var lcdProcClient = require('lcdproc-client');
var lcd = new lcdProcClient(13666, 'localhost');
var mtaApiCredentials = require('./mtaApi.json');

// MTA Bus Time API configuration
var mtaBusTimeApiKey = mtaApiCredentials.apiKey;
var mtaBusTimeEndPoint = 'http://bustime.mta.info/api/siri/stop-monitoring.json';
var mtaBusTimeLineId = 'MTA%20NYCT_M8';
var mtaBusTimeStopId = '401553';
//var mtaBusTimeLineId = 'MTA%20NYCT_M14A';
//var mtaBusTimeStopId = '401659';
var mtaBusTimeApiRequest = mtaBusTimeEndPoint + '?key=' + mtaBusTimeApiKey + '&OperatorRef=MTA&MonitoringRef=' + mtaBusTimeStopId + '&LineRef=' + mtaBusTimeLineId;

// Weather API configuration
var openWeatherApiRequest = 'http://api.openweathermap.org/data/2.5/weather?q=New+York,+NY';

var getJSON = function (url, callback, error) {
  var request = http.get(url, function (res) {
    var data = '';
    res.on('data', function (chunk) {
      data += chunk.toString();
    });
    res.on('end', function () {
      callback(JSON.parse(data));
    });
  });
  if (typeof error === 'function') {
    request.on('error', error);
  }
};

var logError = function (error) {
  console.log(error);
};

var getDeepProperty = function (obj) {
  for (var i = 1; i < arguments.length; i++) {
    if (typeof obj === 'object') {
      obj = obj[arguments[i]];
    }
  }
  return obj;
}

var parseBusStatus = function (data) {

  var busData = getDeepProperty(data, 'Siri', 'ServiceDelivery', 'StopMonitoringDelivery', 0, 'MonitoredStopVisit', 0, 'MonitoredVehicleJourney');
  var busStatus = 'No bus data.';

  if (busData) {
    var busName = busData.PublishedLineName;
    var atLayover = busData.ProgressStatus && busData.ProgressStatus.indexOf('layover') !== -1;
    var previousTrip = busData.ProgressStatus && busData.ProgressStatus.indexOf('prevTrip') !== -1;
    var normalProgress = busData.ProgressRate === 'normalProgress';
    var distance = busData.MonitoredCall.Extensions.Distances.PresentableDistance;
    if (atLayover) {
      busStatus = busName + ' is at layover';
    } else {
      if (previousTrip) {
        busStatus = 'WAIT: ' + busName + ' ' + distance;
      } else {
        busStatus = 'GO NOW: ' + busName + ' ' + distance;
      }
    }
  }

  return busStatus;

};

var convertKtoF = function (temp) {
  return Math.floor((temp - 273.15) * 1.8 + 32);
};

var parseWeather = function (data) {

  var weatherData = getDeepProperty(data, 'weather', 0);
  var tempData = data.main;

  var weatherStatus = 'No weather data.';

  if (weatherData && tempData) {
    var currentTemp = convertKtoF(tempData.temp);
    var highTemp = convertKtoF(tempData.temp_max);
    var description = weatherData.description;
    weatherStatus = 'Cur: ' + currentTemp + ' Hi: ' + highTemp + ' ' + description;
  }

  return weatherStatus;

};

var widgets = {
  'first_line': {
    row: 1,
    default: 'Loading bus info....',
    apiRequest: mtaBusTimeApiRequest,
    apiProcessor: parseBusStatus,
    interval: 30000
  },
  'second_line': {
    row: 2,
    default: 'Loading weather....',
    apiRequest: openWeatherApiRequest,
    apiProcessor: parseWeather,
    interval: 1200000
  }
};

lcd.on('ready', function () {

  lcd.createScreen('BusAndWeather', {
    heartbeat: 'off'
  });

  Object.keys(widgets).forEach(function (key) {

    var widget = widgets[key];

    var updateWidget = function () {
      getJSON(widget.apiRequest, function (data) {
        lcd.updateWidget(key, 1, widget.row, 20, widget.row, "h", 1, widget.apiProcessor(data));
      }, logError);
    };

    lcd.addWidget(key, 'scroller');
    lcd.updateWidget(key, 1, widget.row, 20, widget.row, "h", 1, widget.default);

    updateWidget();
    setInterval(updateWidget, widget.interval);

  });

});

lcd.init();
