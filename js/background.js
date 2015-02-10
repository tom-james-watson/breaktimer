var notificationId;
var countdownId;
var breakId;
var config = {};
var defaults = {
    frequency: 28,
    length: 2,
    notificationType: 'F'
};
var alarmName = 'breakAlarm';
var fullscreenSetInterval;

function clearFullscreenNotification() {
    clearInterval(fullscreenSetInterval);
    chrome.notifications.clear(countdownId, function() {});
}

function createFullScreen() {
    clearFullscreenNotification();

    chrome.windows.create(
        {
            url: '../templates/break.html',
            type: 'detached_panel',
            focused: true
        },
        function(breakWindow) {
            console.log('breakWindowId', breakWindow.id);
            breakId = breakWindow.id;
            chrome.windows.update(breakWindow.id, {
                state: 'fullscreen'
            });
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
            }, 200);
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
        }
    }
});

// Create a new alarm when the break window is closed
chrome.windows.onRemoved.addListener(function(windowId) {
    if (windowId === breakId) {
        createAlarm();
    }
});

chrome.alarms.onAlarm.addListener(handleAlarm);

function createAlarm() {
    console.log('createAlarm');
    chrome.alarms.create(alarmName, {
        delayInMinutes: Number(config.frequency)
    });
    chrome.alarms.get(alarmName, function(alarm) {
        window.alarm = alarm;
        chrome.runtime.sendMessage({
            event: "alarmCreated",
            alarm: alarm
        }, function() {});
    });
}

function setConfig(newConfig) {
    config = newConfig;
    window.config = config;
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

