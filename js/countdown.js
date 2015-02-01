angular.module('myApp', ['ngRoute'])
.controller('CountdownCtrl',
    function($scope, $timeout) {
        $scope.countdown = null;
        var breakEnd = moment().add(30, 'seconds');

        $scope.skip = function() {
            window.close();
        };

        $scope.launchSettings = function() {
            chrome.runtime.sendMessage({
                event: "launchSettings"
            }, function(response) {});
        };

        $scope.start = function() {
            chrome.app.window.create(
                '../templates/break.html',
                {
                    id: 'break',
                    state: 'fullscreen',
                    resizable: false,
                    alwaysOnTop: true
                },
                function(breakWindow) {
                    breakWindow.contentWindow.config = window.config;
                    breakWindow.fullscreen();
                    breakWindow.onClosed.addListener(function() {
                        window.close();
                    });
                }
            );
        };

        var updateCountdown = function() {
            if (breakEnd) {
                var now = moment();

                if (now > breakEnd) {
                    $scope.start();
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
