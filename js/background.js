var notificationId;
var config = {};
var defaults = {
    frequency: 28,
    length: 2,
    notificationType: 'N'
};
var alarmName = 'breakAlarm';

function launch(showSettings) {
    var url;
    if (showSettings === true) {
        url = '../templates/popup.html#/settings';
    } else {
        url = '../templates/popup.html';
    }
    chrome.alarms.get(alarmName, function(alarm) {
        chrome.app.window.create(
            url,
            {
                id: 'main',
                outerBounds: {
                    width: 500,
                    height: 350,
                    minWidth: 500,
                    minHeight: 350,
                    maxWidth: 500,
                    maxHeight: 350
                },
                //frame: 'none', // TODO - add draggable frame
            },
            function(popupWindow) {
                popupWindow.contentWindow.config = config;
                popupWindow.contentWindow.alarm = alarm;
            }
        );
    });
}

function launchCountdown() {
    chrome.app.window.create(
        '../templates/countdown.html',
        {
            id: 'countdown',
            resizable: false,
            outerBounds: {
                width: 300,
                height: 125,
                minWidth: 300,
                minHeight: 125,
                maxWidth: 300,
                maxHeight: 125
            },
            frame: 'none',
            hidden: true,
            alwaysOnTop: true
        },
        function(countdownWindow) {
            window.setTimeout(function() {
                countdownWindow.moveTo(
                    window.screen.width/2 - countdownWindow.getBounds().width/2,
                    10
                );
                countdownWindow.show();
            }, 500);
            countdownWindow.contentWindow.config = config;
            countdownWindow.onClosed.addListener(createAlarm);
        }
    );
}

function createNotification() {
    chrome.notifications.create('reminder', {
        type: 'basic',
        iconUrl: 'image/icon128.png',
        title: 'Time for a break!',
        message: 'Rest your eyes. Stretch your legs. Breathe. Relax.'
    }, function(newNotificationId) {
        notificationId = newNotificationId;
    });

    // Create the next alarm
    createAlarm();

    // Clear notification after 5 seconds
    setTimeout(function() {
        chrome.notifications.clear(notificationId, function() {});
    }, 8000);
}

function handleAlarm() {
    if (config.notificationType === 'N') {
        createNotification();
    } else if (config.notificationType === 'F') {
        launchCountdown();
    }
}

// When the user clicks on the notification, close it
chrome.notifications.onClicked.addListener(function() {
    chrome.notifications.clear(notificationId, function() {});
});

chrome.app.runtime.onLaunched.addListener(launch);

chrome.alarms.onAlarm.addListener(handleAlarm);

function createAlarm() {
    chrome.alarms.create(alarmName, {
        delayInMinutes: Number(config.frequency)
    });
    chrome.alarms.get(alarmName, function(alarm) {
        chrome.runtime.sendMessage({
            event: "alarmCreated",
            alarm: alarm
        }, function() {});
    });
}

function setConfig(newConfig) {
    config = newConfig;
    chrome.storage.local.set({
        config: newConfig
    });
    createAlarm();
}

// Handle runtime messages from other pages in the app
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.event) {
            case 'setConfig':
                setConfig(request.config);
                break;
            case 'createAlarm':
                createAlarm();
                break;
            case 'launchSettings':
                // Remove the onClosed listener of the countdown window to stop
                // a new alarm from being created
                countdownWindow = chrome.app.window.get('countdown');
                countdownWindow.onClosed.removeListener(createAlarm);
                countdownWindow.close();

                // Force a refresh of the main window if it exists
                mainWindow = chrome.app.window.get('main');
                if (mainWindow) {
                    // Use an event listener to prevent race condition
                    mainWindow.onClosed.addListener(function() {
                        launch(true);
                    });
                    mainWindow.close();
                } else {
                    launch(true);
                }
                break;
        }
        sendResponse({success: true});
    }
);

// Grab config from local storage or take defaults
chrome.storage.local.get('config', function(data) {
    if (typeof(data.config) === 'undefined') {
        setConfig(defaults);
    } else {
        setConfig(data.config);
    }
});

// Listen for changes to local storage config
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && 'config' in changes) {
        setConfig(changes.config.newValue);
    }
});

