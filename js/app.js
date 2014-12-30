angular.module('myApp', ['ngRoute'])
.factory('AlarmService', ['$rootScope', function($rootScope) {
    var alarmName = 'breakAlarm';

    chrome.runtime.onMessage.addListener(
        function(request) {
            switch (request.event) {
                case 'alarmCreated':
                    console.log('alarmCreated', request.alarm);
                    $rootScope.$apply(function() {
                        service.alarm = request.alarm;
                    });
            }
        }
    );

    var service = {
        alarm: {},
        checkAlarm: function(callback) {
            chrome.alarms.get(alarmName, function(alarm) {
                service.alarm = alarm;
            });
        },
        createAlarm: function(minutes) {
            chrome.runtime.sendMessage({
                event: "createAlarm"
            }, function(response) {});
        },
        cancelAlarm: function() {
            chrome.alarms.clear(alarmName);
            service.alarm = null;
        }
    };
    chrome.alarms.get(alarmName, function(alarm) {
        service.alarm = alarm;
    });
    return service;
}])
.factory('BreakService', ['$rootScope', 'AlarmService', function($rootScope, AlarmService) {
    var defaults = {
        frequency: 20,
        length: 0.1
    };

    var service = {
        config: {},
        save: function() {
            chrome.runtime.sendMessage({
                event: "setConfig",
                config: service.config
            }, function() {
                AlarmService.cancelAlarm();
                AlarmService.createAlarm(service.config.frequency);
                console.log('setting', service.config);
                chrome.storage.local.set({
                    config: service.config
                });
            });
        },
        restore: function() {
            chrome.storage.local.get('config', function(data) {
                $rootScope.$apply(function() {
                    console.log(data.config);
                    if ('length' in data.config && 'frequency' in data.config) {
                        console.log('yeah newCOnfig');
                        service.config = data.config;
                    } else {
                        console.log('nope defaults');
                        service.config = defaults;
                    }
                });
            });
        }
    };
    service.restore();
    return service;
}])
.config(['$routeProvider', function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl: './home.html',
            controller: 'MainCtrl'
        })
        .when('/settings', {
            templateUrl: './settings.html',
            controller: 'SettingsCtrl'
        })
        .otherwise({redirectTo: '/'});
}])
.controller('MainCtrl',
    function($scope, $timeout, BreakService, AlarmService) {
        $scope.countdown = null;
        $scope.alarm = AlarmService;
        $scope.config = BreakService.config;

        $scope.toggleBreaksOn = function() {
            if ($scope.alarm.alarm) {
                AlarmService.cancelAlarm();
            } else {
                AlarmService.createAlarm(BreakService.config.length);
            }
        };

        var updateCountdown = function() {
            if ($scope.alarm.alarm) {
                $scope.countdown = moment(
                    $scope.alarm.alarm.scheduledTime
                ).countdown(
                    moment(),
                    countdown.HOURS|countdown.MINUTES|countdown.SECONDS
                );
            }
            $timeout(updateCountdown, 1000);
        };

        updateCountdown();
})
.controller('SettingsCtrl',
    function($scope, $location, BreakService, AlarmService) {
        $scope.config = angular.copy(BreakService.config);

        $scope.save = function() {
            console.log('scope.save()');
            BreakService.config = $scope.config;
            BreakService.save();
            $location.path('/');
        };

        $scope.cancel = function() {
            $scope.config = angular.copy(BreakService.config);
            $location.path('/');
        };
})
.filter('digits',
    function() {
        return function(input) {
            if (input < 10) {
                input = '0' + input;
            }

            return input;
        };
});
