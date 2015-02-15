angular.module('BreakTime', [])
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
.controller('PopupCtrl',
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

        $scope.openSettings = function() {
            chrome.tabs.create({url: "templates/settings.html"});
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
    function($scope, ConfigService, AlarmService) {
        $scope.config = angular.copy(ConfigService.config);

        $scope.breaksFrom = toDate($scope.config.breaksFrom);
        $scope.breaksTo = toDate($scope.config.breaksTo);

        function toDate(time) {
            return new Date('1970 01 01 ' + time);
        }

        $scope.breaksFromChanged = function() {
            $scope.config.breaksFrom = moment(
                $scope.breaksFrom
            ).format('HH:mm');
        };

        $scope.breaksToChanged = function() {
            $scope.config.breaksTo = moment(
                $scope.breaksTo
            ).format('HH:mm');
        };

        $scope.save = function() {
            ConfigService.config = angular.copy($scope.config);
            ConfigService.save();
            window.close();
        };

        $scope.cancel = function() {
            $scope.config = angular.copy(ConfigService.config);
            window.close();
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
.controller('BreakCtrl',
    function($scope, $timeout) {
        $scope.countdown = null;
        var breakEnd = moment().add(
            chrome.extension.getBackgroundPage().config.length,
            'minutes'
        );

        $scope.skip = function() {
            window.close();
        };

        var updateCountdown = function() {
            if (breakEnd) {
                var now = moment();

                if (now > breakEnd) {
                    window.close();
                } else {
                    $scope.countdown = breakEnd.countdown(
                        now,
                        countdown.HOURS|countdown.MINUTES|countdown.SECONDS
                    );
                }
            }
            $timeout(updateCountdown, 1000);
        };

        updateCountdown();

        // Close window on Esc or F11
        window.onkeydown = function(e) {
            if (e.keyCode == 27 || e.keyCode == 122) {
                window.close();
            }
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
