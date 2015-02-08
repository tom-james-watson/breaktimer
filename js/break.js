angular.module('myApp', ['ngRoute'])
.controller('BreakCtrl',
    function($scope, $timeout, $document) {
        $scope.countdown = null;
        var breakEnd = moment().add(
            window.config.length,
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

        // Close window on Esc
        window.onkeydown = function(e) {
            if (e.keyCode == 27 /* ESC */) {
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
