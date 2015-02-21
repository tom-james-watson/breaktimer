var notificationId;
var countdownId;
var breakId;
var config = {};
var idleState = 'active';
var idleStart;
var defaults = {
    frequency: 28,
    length: 2,
    notificationType: 'F',
    workingHoursFrom: '09:00',
    workingHoursTo: '17:00',
    workingHoursEnabled: true,
    idleResetMinutes: 5,
    idleResetEnabled: true
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
            {title: 'Postpone 3 minutes', iconUrl: 'image/postpone.png'}
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

function getOutsideWorkingHours() {
    if (config.workingHoursEnabled === false) {
        return false;
    }

    var workingHoursFrom = moment(
        config.workingHoursFrom,
        'HH:mm'
    );
    var workingHoursTo = moment(
        config.workingHoursTo,
        'HH:mm'
    );
    var now = moment();
    return !(
        (workingHoursFrom <= now) &&
        (now <= workingHoursTo)
    );
}

function handleAlarm() {
    if (getOutsideWorkingHours()) {
        createAlarm();
    } else {
        if (config.notificationType === 'N') {
            createNotification();
        } else if (config.notificationType === 'F') {
            createFullscreenNotification();
        }
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
            // Postpone
            clearFullscreenNotification();
            createAlarm(3);
        }
    }
});

// Set idle detection interval to 5 minutes
chrome.idle.setDetectionInterval(15);

// Handle user state idle change
chrome.idle.onStateChanged.addListener(function (newState) {
    if (config.idleResetEnabled) {
        idleState = newState;

        // Reset countdown when returning from idle period of more than
        // config.idleResetMinutes minutes
        if (['idle', 'locked'].indexOf(idleState) > -1) {
            idleStart = moment();
        } else if (idleState === 'active') {
            var idleMinutes = moment().diff(idleStart, 'seconds');
            if (idleMinutes > config.idleResetMinutes) {
                createAlarm();
                chrome.notifications.create('idleRestart', {
                    type: 'basic',
                    iconUrl: 'image/icon128.png',
                    title: 'Break has been reset',
                    message: '',
                    contextMessage: 'You were idle for '+idleMinutes+' minutes'
                }, function() {});
            }
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

function createAlarm(minutes) {
    if (typeof(minutes) === 'undefined') {
        minutes = Number(config.frequency)
    }
    chrome.alarms.create(alarmName, {
        delayInMinutes: minutes
    });
    chrome.alarms.get(alarmName, function(alarm) {
        alarmTime = new Date(alarm.scheduledTime);
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

