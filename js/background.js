var notificationId;
var config = {};
var defaults = {
    frequency: 28,
    length: 2,
    notificationType: 'N'
};
var alarmName = 'breakAlarm';

function launch() {
    chrome.alarms.get(alarmName, function(alarm) {
        chrome.app.window.create(
            '../templates/popup.html',
            {
                id: 'main',
                outerBounds: { width: 480, height: 300 },
                //frame: 'none', TODO - add draggable frame
            },
            function(popupWindow) {
                popupWindow.contentWindow.config = config;
                popupWindow.contentWindow.alarm = alarm;
            }
        );
    });
}

function handleAlarm() {

    if (config.notificationType === 'N') {
        // Create the notification
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
    } else if (config.notificationType === 'F') {
        // Open the fullscreen break popup
        chrome.app.window.create(
            '../templates/break.html',
            {
                id: 'break',
                state: 'fullscreen',
            },
            function(breakWindow) {
                breakWindow.contentWindow.config = config;
                breakWindow.onClosed.addListener(function() {
                    createAlarm();
                });
            }
        );
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
            case 'createAlarm':
                createAlarm();
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

