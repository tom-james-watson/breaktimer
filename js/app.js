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
      createAlarm: function(minutes) {
        chrome.runtime.sendMessage({
          event: "createAlarm",
          minutes: minutes
        }, function(response) {});
      },
      cancelAlarm: function() {
        chrome.runtime.sendMessage({
          event: "cancelAlarm"
        }, function(response) {});
        this.alarm = null;
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
    function($scope, $timeout, AlarmService, ConfigService) {
      $scope.notificationType = ConfigService.config.notificationType;
      $scope.workingHoursFrom = moment(
        ConfigService.config.workingHoursFrom,
        'HH:mm'
      );
      $scope.workingHoursTo = moment(
        ConfigService.config.workingHoursTo,
        'HH:mm'
      );
      $scope.backgroundColor = ConfigService.config.backgroundColor;
      $scope.textColor = ConfigService.config.textColor;

      $scope.countdown = null;
      $scope.alarm = AlarmService;

      var working = moment().add(
        chrome.extension.getBackgroundPage().config.length,
        'minutes'
      );

      $scope.toggleBreaksOn = function() {
        const config = angular.copy(ConfigService.config);

        if ($scope.alarm.alarm) {
          config.breaksEnabled = false;
          chrome.runtime.sendMessage({
            event: "clearFullscreenNotification"
          }, function(response) {});
        } else {
          config.breaksEnabled = true;
        }
        ConfigService.config = config;
        ConfigService.save();
      };

      $scope.restartBreak = function() {
        AlarmService.createAlarm();
      };

      $scope.startBreak = function() {
        AlarmService.cancelAlarm();
        chrome.runtime.sendMessage({
          event: "startBreak"
        }, function(response) {});
        window.close();
      };

      $scope.openSettings = function() {
        chrome.tabs.create({url: "/templates/settings.html"});
      };

      function getWorkingDayEnabled(day) {
        workingDayEnabled = null;
        ConfigService.config.workingHoursDays.forEach(function(whDay) {
          if (whDay.name === day) {
            workingDayEnabled = whDay.enabled;
          }
        });
        return workingDayEnabled;
      }

      var updateCountdown = function() {
        $scope.now = moment();
        $scope.outsideWorkingHours = (
          ConfigService.config.workingHoursEnabled &&
          !(
            (getWorkingDayEnabled($scope.now.format('ddd'))) &&
            ($scope.workingHoursFrom <= $scope.now) &&
            ($scope.now <= $scope.workingHoursTo)
          )
        );
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
    function($scope, ConfigService, AlarmService, $timeout) {
      $scope.config = angular.copy(ConfigService.config);
      $scope.isFirefox = navigator.userAgent.indexOf("Firefox") > -1

      $scope.workingHoursFrom = toDate($scope.config.workingHoursFrom);
      $scope.workingHoursTo = toDate($scope.config.workingHoursTo);

      $scope.showSaveConfirm = false;

      function toDate(time) {
        // input type=time requires a Date
        return new Date('1970 01 01 ' + time);
      }

      function grabTime(date) {
        // Extract time string from time input
        return moment(date).format('HH:mm');
      }

      $scope.workingHoursFromChanged = function() {
        $scope.config.workingHoursFrom = grabTime($scope.workingHoursFrom);
      };

      $scope.workingHoursToChanged = function() {
        $scope.config.workingHoursTo = grabTime($scope.workingHoursTo);
      };

      $scope.checkOrder = function() {
        return (
          moment($scope.workingHoursFrom) < moment($scope.workingHoursTo)
        );
      };

      $scope.save = function() {
        ConfigService.config = angular.copy($scope.config);
        ConfigService.save();
        $scope.showSaveConfirm = true;
        $timeout(function() {
          $scope.showSaveConfirm = false;
        }, 3000);
      };

      $scope.notifTypes = [{
        id: 1,
        name: 'Notification',
        value: 'N'
      }, {
        id: 2,
        name: 'Fullscreen popup',
        value: 'F'
      }];

      for (var i=0; i < $scope.notifTypes.length; i++) {
        if ($scope.notifTypes[i].value === $scope.config.notificationType) {
          $scope.selected = $scope.notifTypes[i];
        }
      }

      $scope.selectNotifType = function() {
        $scope.config.notificationType = $scope.selected.value;
      };
    })
  .controller('BreakCtrl',
    function($scope, $timeout, ConfigService) {
      $scope.countdown = null;
      $scope.breakText = ConfigService.config.breakText;
      $scope.breakMessage = ConfigService.config.breakMessage;
      $scope.backgroundColor = ConfigService.config.backgroundColor;
      $scope.textColor = ConfigService.config.textColor;
      $scope.allowEndBreak = ConfigService.config.allowEndBreak;
      var breakEnd = moment().add(ConfigService.config.length, 'minutes');

      $scope.skip = function() {
        chrome.runtime.sendMessage({event: "endBreak"});
      };

      var updateCountdown = function() {
        if (breakEnd) {
          var now = moment();

          if (now > breakEnd) {
            $scope.skip();
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
      const handleKeyPress = function(e) {
        if ($scope.allowEndBreak && (e.keyCode == 27 || e.keyCode == 122)) {
          $scope.skip();
        }
        e.preventDefault();
      };
      window.onkeydown = handleKeyPress;
      window.onkeypress = handleKeyPress;
      window.onkeyup = handleKeyPress;
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
