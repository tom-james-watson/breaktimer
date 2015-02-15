angular.module('popup', ['ngRoute'])
.factory('AlarmService', ['$rootScope', function($rootScope) {
    var alarmName = 'breakAlarm';

    chrome.runtime.onMessage.addListener(
        function(request) {
            switch (request.event) {
                case 'alarmCreated':
                    $rootScope.$apply(function() {
                        service.alarm = request.alarm;
                    });
            }
        }
    );

    var service = {
        alarm: angular.copy(chrome.extension.getBackgroundPage().alarm),
        createAlarm: function() {
            chrome.runtime.sendMessage({
                event: "createAlarm"
            }, function(response) {});
        },
        cancelAlarm: function() {
            chrome.alarms.clear(alarmName);
            service.alarm = null;
        }
    };
    return service;
}])
.factory('ConfigService', ['$rootScope', 'AlarmService', function($rootScope, AlarmService) {
    var service = {
        config: angular.copy(chrome.extension.getBackgroundPage().config),
        save: function() {
            AlarmService.cancelAlarm();
            chrome.runtime.sendMessage({
                event: "setConfig",
                config: service.config
            }, function() {});
        },
    };
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
    function($scope, $timeout, AlarmService) {
        $scope.countdown = null;
        $scope.alarm = AlarmService;

        $scope.toggleBreaksOn = function() {
            if ($scope.alarm.alarm) {
                AlarmService.cancelAlarm();
            } else {
                AlarmService.createAlarm();
            }
        };

        $scope.restartBreak = function() {
            AlarmService.createAlarm();
        };

        var updateCountdown = function() {
            if ($scope.alarm.alarm) {
                now = moment();
                if (now > $scope.alarm.alarm.scheduledTime) {
                    $timeout(updateCountdown, 1000);
                    return;
                } else {
                    $scope.countdown = moment(
                        $scope.alarm.alarm.scheduledTime
                    ).countdown(
                        now,
                        countdown.HOURS|countdown.MINUTES|countdown.SECONDS
                    );
                }
            }
            $timeout(updateCountdown, 1000);
        };

        updateCountdown();
})
.controller('SettingsCtrl',
    function($scope, $location, ConfigService, AlarmService) {
        $scope.config = angular.copy(ConfigService.config);
        console.log('SettingsCtrl');

        $scope.save = function() {
            ConfigService.config = angular.copy($scope.config);
            ConfigService.save();
            $location.path('/');
        };

        $scope.cancel = function() {
            $scope.config = angular.copy(ConfigService.config);
            $location.path('/');
        };

        $scope.values = [{
            id: 1,
            name: 'Notification',
            value: 'N'
        }, {
            id: 2,
            name: 'Fullscreen popup',
            value: 'F'
        }];

        for (var i=0; i < $scope.values.length; i++) {
            if ($scope.values[i].value === $scope.config.notificationType) {
                $scope.selected = $scope.values[i];
            }
        }

        $scope.selectNotify = function() {
            $scope.config.notificationType = $scope.selected.value;
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
