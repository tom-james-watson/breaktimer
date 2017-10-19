var notificationId;
var countdownId;
var breakId;
var config = {};
var idleState = 'active';
var idleStart;
var alarmName = 'breakAlarm';
var fullscreenSetInterval;

var defaultConfig = {
    frequency: 28,
    length: 2,
    postpone: 3,
    notificationType: 'F',
    workingHoursFrom: '09:00',
    workingHoursTo: '17:30',
    workingHoursDays: [
        {
            name: 'Mon',
            enabled: true
        },
        {
            name: 'Tue',
            enabled: true
        },
        {
            name: 'Wed',
            enabled: true
        },
        {
            name: 'Thu',
            enabled: true
        },
        {
            name: 'Fri',
            enabled: true
        },
        {
            name: 'Sat',
            enabled: false
        },
        {
            name: 'Sun',
            enabled: false
        }
    ],
    workingHoursEnabled: true,
    idleResetMinutes: 5,
    idleResetEnabled: true,
    breaksEnabled: true
};

// Grab config from local storage mergded with defaultConfig
chrome.storage.local.get('config', function(data) {
    var config = Object.assign({}, defaultConfig, data.config);
    setConfig(config);
});

function clearFullscreenNotification() {
    clearInterval(fullscreenSetInterval);
    if (typeof(countdownId) !== 'undefined') {
        chrome.notifications.clear(countdownId, function() {});
    }
}

function createFullscreen() {
    clearFullscreenNotification();

    chrome.windows.create(
        {
            url: '../templates/break.html',
            type: 'panel',
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
    // Create a complex notification with countdown to fullscreen break

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
            {title: 'Postpone ' + config.postpone + ' minutes', iconUrl: 'image/postpone.png'}
        ]
    };

    chrome.notifications.create(
        'countdown',
        notificationOptions,
        function(newNotificationId) {
            countdownId = newNotificationId;

            // Fill notification progress bar
            fullscreenSetInterval = setInterval(function() {
                notificationOptions.progress += 5;
                if (notificationOptions.progress == 100) {
                   createFullscreen();
                }
                else {
                    chrome.notifications.update(
                        countdownId,
                        notificationOptions,
                        function() {}
                    );
                }
            }, 1000);
        });
}

function createNotification() {
    // Create simple alert notification

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

function checkOutsideWorkingHours() {
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
    workingDayEnabled = getWorkingDayEnabled(now.format('ddd'));
    return !(
        (workingDayEnabled) &&
        (workingHoursFrom <= now) &&
        (now <= workingHoursTo)
    );
}

function getWorkingDayEnabled(day) {
    workingDayEnabled = null;
    config.workingHoursDays.forEach(function(whDay) {
        if (whDay.name === day) {
            workingDayEnabled = whDay.enabled;
        }
    });
    return workingDayEnabled;
}

function handleAlarm() {
    if (checkOutsideWorkingHours()) {
        createAlarm();
    } else if (config.idleResetEnabled &&
               ['idle', 'locked'].indexOf(idleState) > -1 &&
               checkIdleMinutes()) {
        // Prevent breaks when we've been idle for more than
        // config.idleResetMinutes minutes
        createAlarm();
    } else {
        if (config.notificationType === 'N') {
            createNotification();
        } else if (config.notificationType === 'F') {
            createFullscreenNotification();
        }
    }
}

function startBreak() {
    if (config.notificationType === 'N') {
        createNotification();
    } else if (config.notificationType === 'F') {
        createFullscreen();
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
            createAlarm(config.postpone);
        }
    }
});

// Set idle detection interval to 15 seconds
chrome.idle.setDetectionInterval(15);

function checkIdleMinutes() {
    // Check if user has been idle for more than configured minutes

    var idleMinutes = moment().diff(idleStart, 'minutes');
    if (idleMinutes > config.idleResetMinutes) {
        return true;
    } else {
        return false;
    }
}

// Handle user state idle change
chrome.idle.onStateChanged.addListener(function (newState) {
    if (config.idleResetEnabled) {
        idleState = newState;

        // Reset countdown when returning from idle period of more than
        // config.idleResetMinutes minutes
        if (['idle', 'locked'].indexOf(idleState) > -1) {
            idleStart = moment();
        } else if (idleState === 'active') {
            if (checkIdleMinutes()) {
                createAlarm();
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
        minutes = Number(config.frequency);
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

    console.log({config})
    if (config.breaksEnabled) {
        createAlarm();
    }
}

// Handle runtime messages from other pages in the app
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch (request.event) {
            case 'setConfig':
                setConfig(request.config);
                break;
            case 'createAlarm':
                createAlarm(request.minutes);
                break;
            case 'cancelAlarm':
                chrome.alarms.clear(alarmName);
                window.alarm = null;
                break;
            case 'startBreak':
                startBreak();
                break;
        }
        sendResponse({success: true});
    }
);
