var notificationId;
var countdownId;
var config = {};
var defaults = {
    frequency: 28,
    length: 2,
    notificationType: 'F'
};
var alarmName = 'breakAlarm';
var fullscreenSetInterval;

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

function launchSettings() {
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
}

function clearFullscreenNotification() {
    clearInterval(fullscreenSetInterval);
    chrome.notifications.clear(countdownId, function() {});
}

function createFullScreen() {
    clearFullscreenNotification();

    chrome.app.window.create(
        '../templates/break.html',
        {
            id: 'countdown',
            resizable: false,
            alwaysOnTop: true
        },
        function(breakWindow) {
            breakWindow.contentWindow.config = config;
            breakWindow.fullscreen();
            breakWindow.onClosed.addListener(createAlarm);
        }
    );
}

function createFullscreenNotification() {
    var notificationOptions = {
        type: 'progress',
        iconUrl: 'image/icon128.png',
        progress: 0,
        priority: 2,
        title: 'Time for a break!',
        message: 'Break about to start...',
        isClickable: true,
        buttons: [
            {title: 'Skip', iconUrl: 'image/skip.png'},
            {title: 'Options', iconUrl: 'image/options.png'},
        ]
    };

    chrome.notifications.create(
        'countdown',
        notificationOptions,
        function(newNotificationId) {
            countdownId = newNotificationId;
            fullscreenSetInterval = setInterval(function() {
                notificationOptions.progress += 10;
                if (notificationOptions.progress == 100) {
                   createFullScreen();
                }
                else {
                    chrome.notifications.update(
                        countdownId,
                        notificationOptions,
                        function() {}
                    );
                }
            }, 2000);
        });
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
        createFullscreenNotification();
    }
}

// When the user clicks on the notification, close it
chrome.notifications.onClicked.addListener(function(id) {
    chrome.notifications.clear(id, function() {});
});

// When the user clicks on a notification button, handle it
chrome.notifications.onButtonClicked.addListener(function(id, buttonIndex) {
    if (id === countdownId) {
        if (buttonIndex === 0) {
            // Skip
            clearFullscreenNotification();
            createAlarm();
        } else if (buttonIndex === 1) {
            // Options
            clearFullscreenNotification();
            launchSettings();
        }
    }
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
                launchSettings();
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

